use std::path::Path;

use anyhow::Result;
use tantivy::directory::MmapDirectory;
use tantivy::schema::*;
use tantivy::{Index, IndexReader, IndexWriter};

pub struct SearchIndex {
    pub index: Index,
    pub reader: IndexReader,
    pub url_field: Field,
    pub title_field: Field,
    pub desc_field: Field,
    pub content_field: Field,
}

impl SearchIndex {
    pub fn open_or_create(index_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(index_dir)?;

        let mut schema_builder = Schema::builder();

        let url_field = schema_builder.add_text_field("url", STRING | STORED);
        let title_field = schema_builder.add_text_field(
            "title",
            TEXT | STORED,
        );
        let desc_field = schema_builder.add_text_field(
            "description",
            TEXT | STORED,
        );
        let content_field = schema_builder.add_text_field(
            "content",
            TEXT | STORED,
        );

        let schema = schema_builder.build();
        let dir = MmapDirectory::open(index_dir)?;
        let index = Index::open_or_create(dir, schema)?;

        let reader = index
            .reader_builder()
            .reload_policy(tantivy::ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        Ok(SearchIndex {
            index,
            reader,
            url_field,
            title_field,
            desc_field,
            content_field,
        })
    }

    pub fn writer(&self) -> Result<IndexWriter> {
        Ok(self.index.writer(100_000_000)?)
    }
}
