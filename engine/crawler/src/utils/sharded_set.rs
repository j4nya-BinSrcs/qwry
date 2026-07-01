use std::{
    collections::HashSet,
    hash::{DefaultHasher, Hash, Hasher},
    sync::{Arc, Mutex},
};

#[derive(Clone, Debug)]
pub struct ShardedSet {
    shards: Arc<Vec<Mutex<HashSet<String>>>>,
    mask: usize,
}

impl ShardedSet {
    pub fn new(num_shards: usize) -> Self {
        let n = num_shards.next_power_of_two();
        let mut shards = Vec::with_capacity(n);
        for _ in 0..n {
            shards.push(Mutex::new(HashSet::new()));
        }
        Self {
            shards: Arc::new(shards),
            mask: n - 1,
        }
    }

    fn shard(&self, s: &str) -> &Mutex<HashSet<String>> {
        let mut hasher = DefaultHasher::new();
        s.hash(&mut hasher);
        let idx = hasher.finish() as usize & self.mask;
        &self.shards[idx]
    }

    pub fn insert(&self, s: String) -> bool {
        self.shard(&s).lock().unwrap().insert(s)
    }

    pub fn contains(&self, s: &str) -> bool {
        self.shard(s).lock().unwrap().contains(s)
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn test_sharded_set_new_rounds_to_power_of_two() {
        let set = ShardedSet::new(10);
        assert_eq!(set.shards.len(), 16);
        assert_eq!(set.mask, 15);
    }

    #[test]
    fn test_sharded_set_insert_and_contains() {
        let set = ShardedSet::new(8);
        assert!(set.insert("hello".into()));
        assert!(set.contains("hello"));
        assert!(!set.contains("world"));
    }

    #[test]
    fn test_sharded_set_insert_returns_false_for_duplicates() {
        let set = ShardedSet::new(8);
        assert!(set.insert("hello".into()));
        assert!(!set.insert("hello".into()));
    }

    #[test]
    fn test_sharded_set_len() {
        let set = ShardedSet::new(8);
        assert_eq!(set.len(), 0);
        set.insert("a".into());
        set.insert("b".into());
        set.insert("c".into());
        assert_eq!(set.len(), 3);
        set.insert("a".into());
        assert_eq!(set.len(), 3);
    }

    #[test]
    fn test_sharded_set_no_duplicates_under_concurrency() {
        let set = Arc::new(ShardedSet::new(64));
        let mut handles = Vec::new();
        for _ in 0..8 {
            let s = Arc::clone(&set);
            handles.push(std::thread::spawn(move || {
                for i in 0..500 {
                    s.insert(format!("thread-{i}"));
                }
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        assert_eq!(set.len(), 500);
    }

    #[test]
    fn test_sharded_set_concurrent_inserts() {
        let set = Arc::new(ShardedSet::new(16));
        let counter = Arc::new(AtomicUsize::new(0));
        let mut handles = Vec::new();
        for t in 0..4 {
            let s = Arc::clone(&set);
            let c = Arc::clone(&counter);
            handles.push(std::thread::spawn(move || {
                for i in 0..1000 {
                    if s.insert(format!("key-{i}")) {
                        c.fetch_add(1, Ordering::Relaxed);
                    }
                }
                let _ = t;
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        assert_eq!(counter.load(Ordering::Relaxed), 1000);
        assert_eq!(set.len(), 1000);
    }

    #[test]
    fn test_sharded_set_distribution() {
        let set = ShardedSet::new(16);
        for i in 0..1000 {
            set.insert(format!("key-{i}"));
        }
        for shard in set.shards.iter() {
            let len = shard.lock().unwrap().len();
            assert!(len > 0, "every shard should have at least one item");
        }
    }
}
