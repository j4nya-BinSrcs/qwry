use clap::Parser;
use crawler::core::config::CrawlerConfig;
use crawler::core::engine::Crawler;
use shared::init_db;
use std::time::Duration;

#[derive(Parser, Debug)]
#[command(name = "crawler", about = "Qwry web crawler")]
struct Args {
    #[arg(short = 's', long, default_values = &["https://example.com"])]
    seeds: Vec<String>,

    #[arg(long, default_value = "3")]
    max_depth: usize,

    #[arg(long, default_value = "100")]
    max_pages: usize,

    #[arg(long, default_value = "10")]
    concurrency: usize,

    #[arg(long, default_value = "1.0")]
    politeness_delay_secs: f64,

    #[arg(long, default_value = "QwryBot/0.1")]
    user_agent: String,

    #[arg(long)]
    external_domains: bool,

    #[arg(long, default_value = "3")]
    max_retries: u32,

    #[arg(long, default_value = "5.0")]
    retry_base_delay_secs: f64,

    #[arg(long)]
    skip_politeness: bool,

    #[arg(long, default_value = "100")]
    batch_db_check_size: usize,

    #[arg(long)]
    lightweight: bool,

    #[arg(long)]
    adaptive_concurrency: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    let db_pool = init_db().await?;

    let config = CrawlerConfig {
        max_depth: args.max_depth,
        max_pages: args.max_pages,
        concurrency: args.concurrency,
        politeness_delay: Duration::from_secs_f64(args.politeness_delay_secs),
        user_agent: args.user_agent,
        external_domains: args.external_domains,
        max_retries: args.max_retries,
        retry_base_delay: Duration::from_secs_f64(args.retry_base_delay_secs),
        skip_politeness: args.skip_politeness,
        batch_db_check_size: args.batch_db_check_size,
        lightweight: args.lightweight,
        adaptive_concurrency: args.adaptive_concurrency,
    };

    let crawler = Crawler::new(config, db_pool);

    tracing::info!("starting crawl of {} seed(s) ...", args.seeds.len());
    crawler.run(&args.seeds).await;
    tracing::info!("crawl finished");

    Ok(())
}
