use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, Subcommand};
use indexer::services::index;
use indexer::services::serve;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "indexer", about = "Qwry search indexer")]
struct Cli {
    #[arg(long, default_value = "./data/index")]
    index_dir: PathBuf,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Index unindexed pages from the database into Tantivy
    Index,
    /// Delete and rebuild the entire index from all crawled pages
    Reindex,
    /// Search the index with a BM25 query
    Search {
        query: String,
        #[arg(long, default_value = "10")]
        limit: usize,
        #[arg(long, default_value = "0")]
        offset: usize,
    },
    /// Start the search API server
    Serve {
        #[arg(long, default_value = "8001")]
        port: u16,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let cli = Cli::parse();

    let search_index = index::SearchIndex::open_or_create(&cli.index_dir)?;
    tracing::info!(path = %cli.index_dir.display(), "Index opened/created");

    let db_pool = shared::init_db().await?;

    match &cli.command {
        Command::Index => {
            let count = search_index.index_new_pages(&db_pool).await?;
            if count == 0 {
                tracing::info!("No new pages to index");
            } else {
                tracing::info!(%count, "Indexed pages");
            }
        }
        Command::Reindex => {
            tracing::info!("Rebuilding index from scratch...");
            let count = search_index.reindex_all_pages(&db_pool).await?;
            tracing::info!(%count, "Reindex complete");
        }
        Command::Search { query, limit, offset } => {
            let response = search_index.search(query, *limit, *offset)?;
            let json = serde_json::to_string_pretty(&response)?;
            println!("{json}");
        }
        Command::Serve { port } => {
            serve::run_server(search_index, db_pool, *port).await?;
        }
    }

    Ok(())
}
