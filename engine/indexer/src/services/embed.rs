use anyhow::Result;
use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};

pub struct EmbeddingGenerator {
    model: TextEmbedding,
    model_name: String,
}

impl EmbeddingGenerator {
    pub fn new() -> Result<Self> {
        let options = TextInitOptions::new(EmbeddingModel::BGESmallENV15)
            .with_show_download_progress(false);
        let model = TextEmbedding::try_new(options)?;
        Ok(EmbeddingGenerator {
            model,
            model_name: "BGE-small-en-v1.5".into(),
        })
    }

    pub fn model_name(&self) -> &str {
        &self.model_name
    }

    pub fn dimension(&self) -> usize {
        384
    }

    pub fn generate(&mut self, texts: &[&str]) -> Result<Vec<Vec<f32>>> {
        let owned: Vec<String> = texts.iter().map(|s| s.to_string()).collect();
        let embeddings = self.model.embed(owned, Some(128))?;
        Ok(embeddings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[ignore = "requires network to download embedding model (run with -- --ignored)"]
    #[test]
    fn test_generate_returns_correct_number_of_embeddings() {
        let mut generator = EmbeddingGenerator::new().expect("Failed to load embedding model");
        let texts = &["hello world", "rust programming", "semantic search"];
        let embeddings = generator.generate(texts).expect("generate should succeed");
        assert_eq!(embeddings.len(), 3);
        for emb in &embeddings {
            assert_eq!(emb.len(), 384);
        }
    }

    #[ignore = "requires network to download embedding model (run with -- --ignored)"]
    #[test]
    fn test_generate_empty_input_returns_empty() {
        let mut generator = EmbeddingGenerator::new().expect("Failed to load embedding model");
        let embeddings = generator.generate(&[]).expect("generate with empty input should succeed");
        assert!(embeddings.is_empty());
    }

    #[ignore = "requires network to download embedding model (run with -- --ignored)"]
    #[test]
    fn test_semantic_similarity_similar_texts_have_higher_similarity() {
        let mut generator = EmbeddingGenerator::new().expect("Failed to load embedding model");
        let embeddings = generator.generate(&[
            "the cat sat on the mat",
            "a kitten rested on a rug",
            "quantum physics and black holes",
        ]).expect("generate should succeed");

        fn cosine_sim(a: &[f32], b: &[f32]) -> f32 {
            let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
            let na: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
            let nb: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
            dot / (na * nb)
        }

        let cat_cat = cosine_sim(&embeddings[0], &embeddings[0]);
        let cat_dog = cosine_sim(&embeddings[0], &embeddings[1]);
        let cat_quantum = cosine_sim(&embeddings[0], &embeddings[2]);

        assert!((cat_cat - 1.0).abs() < 1e-5, "self-similarity should be ~1.0, got {cat_cat}");
        assert!(cat_dog > cat_quantum,
            "cat/dog ({cat_dog}) should be more similar than cat/quantum ({cat_quantum})");
    }
}
