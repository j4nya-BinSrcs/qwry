use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

mod index;

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

    let _index = index::SearchIndex::open_or_create(&cli.index_dir)?;
    tracing::info!(path = %cli.index_dir.display(), "Index opened/created");

    match &cli.command {
        Command::Serve { port } => {
            tracing::info!(%port, "Starting search server...");
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
            }
        }
    }
}
