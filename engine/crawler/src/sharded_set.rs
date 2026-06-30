use std::{
    collections::HashSet,
    hash::{DefaultHasher, Hash, Hasher},
    sync::{Arc, Mutex},
};

// ---------------------------------------------------------------------------
// ShardedSet – concurrent visited-url set sharded by hash
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct ShardedSet {
    shards: Arc<Vec<Mutex<HashSet<String>>>>,
    mask: usize,
}

impl ShardedSet {
    pub fn new(num_shards: usize) -> Self {
        let num_shards = num_shards.max(1).next_power_of_two();
        let mut shards = Vec::with_capacity(num_shards);
        for _ in 0..num_shards {
            shards.push(Mutex::new(HashSet::new()));
        }
        Self {
            shards: Arc::new(shards),
            mask: num_shards - 1,
        }
    }

    fn shard_idx(&self, key: &str) -> usize {
        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        hasher.finish() as usize & self.mask
    }

    pub fn contains(&self, key: &str) -> bool {
        let idx = self.shard_idx(key);
        self.shards[idx].lock().unwrap().contains(key)
    }

    pub fn insert(&self, key: String) -> bool {
        let idx = self.shard_idx(&key);
        self.shards[idx].lock().unwrap().insert(key)
    }

    pub fn len(&self) -> usize {
        self.shards
            .iter()
            .map(|s| s.lock().unwrap().len())
            .sum()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn shard_count(&self) -> usize {
        self.shards.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
#[test]
fn test_sharded_set_new_rounds_to_power_of_two() {
    let set = ShardedSet::new(10);
    assert_eq!(set.shard_count(), 16);

    let set = ShardedSet::new(1);
    assert_eq!(set.shard_count(), 1);

    let set = ShardedSet::new(0);
    assert_eq!(set.shard_count(), 1);
}

#[test]
fn test_sharded_set_insert_and_contains() {
    let set = ShardedSet::new(8);
    assert!(set.insert("https://example.com".into()));
    assert!(set.contains("https://example.com"));
    assert!(!set.contains("https://other.com"));
}

#[test]
fn test_sharded_set_insert_returns_false_for_duplicates() {
    let set = ShardedSet::new(8);
    assert!(set.insert("https://example.com".into()));
    assert!(!set.insert("https://example.com".into()));
}

#[test]
fn test_sharded_set_len() {
    let set = ShardedSet::new(8);
    assert_eq!(set.len(), 0);
    assert!(set.is_empty());

    set.insert("a".into());
    set.insert("b".into());
    set.insert("c".into());
    assert_eq!(set.len(), 3);
    assert!(!set.is_empty());
}

#[test]
fn test_sharded_set_distribution() {
    let set = ShardedSet::new(8);
    // Insert enough keys to exercise all shards
    for i in 0..256 {
        set.insert(format!("https://page-{}.com", i));
    }

    // Every shard should have at least one entry (very unlikely to fail with 256 keys)
    for (i, shard) in set.shards.iter().enumerate() {
        assert!(
            !shard.lock().unwrap().is_empty(),
            "shard {} should not be empty",
            i
        );
    }
}

#[tokio::test]
async fn test_sharded_set_concurrent_inserts() {
    let set = Arc::new(ShardedSet::new(64));
    let mut handles = Vec::new();

    for i in 0..100 {
        let s = Arc::clone(&set);
        handles.push(tokio::spawn(async move {
            s.insert(format!("https://page-{}.com", i));
        }));
    }

    for h in handles {
        h.await.unwrap();
    }

    assert_eq!(set.len(), 100);
    assert!(set.contains("https://page-42.com"));
}

#[tokio::test]
async fn test_sharded_set_no_duplicates_under_concurrency() {
    let set = Arc::new(ShardedSet::new(64));
    let mut handles = Vec::new();

    // 10 writers all try to insert the same 10 URLs
    for _ in 0..10 {
        let s = Arc::clone(&set);
        handles.push(tokio::spawn(async move {
            for i in 0..10 {
                s.insert(format!("https://page-{}.com", i));
            }
        }));
    }

    for h in handles {
        h.await.unwrap();
    }

    assert_eq!(set.len(), 10, "only 10 unique URLs out of 100 attempts");
}

}
