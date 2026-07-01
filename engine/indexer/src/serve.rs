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

use indexer::index::SearchIndex;

#[derive(Deserialize)]
pub struct SearchParams {
    q: String,
    limit: Option<usize>,
    offset: Option<usize>,
}

async fn search_handler(
    State(index): State<Arc<SearchIndex>>,
    Query(params): Query<SearchParams>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(10).min(100);
    let offset = params.offset.unwrap_or(0);

    match index.search(&params.q, limit, offset) {
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
    index: SearchIndex,
    _db_pool: DbPool,
    port: u16,
) -> Result<()> {
    let index = Arc::new(index);

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/search", get(search_handler))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(index);

    let addr = format!("0.0.0.0:{port}");
    tracing::info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
