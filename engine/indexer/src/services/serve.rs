use std::sync::Arc;

use anyhow::Result;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use serde::Deserialize;
use shared::DbPool;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::services::search::{FusionConfig, SearchMode};
use crate::services::sharded::ShardedIndex;

struct AppState {
    index: Arc<ShardedIndex>,
    db: DbPool,
}

#[derive(Deserialize)]
pub struct SearchParams {
    q: String,
    limit: Option<usize>,
    offset: Option<usize>,
    mode: Option<String>,
    rerank: Option<bool>,
    alpha: Option<f32>,
    beta: Option<f32>,
}

async fn search_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchParams>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(10).min(100);
    let offset = params.offset.unwrap_or(0);
    let mode = params.mode.as_deref().unwrap_or("hybrid").parse::<SearchMode>().unwrap_or(SearchMode::Hybrid);
    let fusion = FusionConfig {
        alpha: params.alpha.unwrap_or(0.5),
        beta: params.beta.unwrap_or(0.5),
        rrf_k: 60.0,
    };
    let do_rerank = params.rerank.unwrap_or(false);

    match state.index.search(&state.db, &params.q, limit, offset, mode, fusion, do_rerank).await {
        Ok(response) => (StatusCode::OK, axum::Json(serde_json::json!(response))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({"error": e.to_string()})),
        ),
    }
}

async fn health_handler() -> impl IntoResponse {
    (StatusCode::OK, axum::Json(serde_json::json!({"status": "ok"})))
}

pub async fn run_server(
    index: ShardedIndex,
    db_pool: DbPool,
    port: u16,
) -> Result<()> {
    let state = Arc::new(AppState {
        index: Arc::new(index),
        db: db_pool,
    });

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/search", get(search_handler))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    tracing::info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
