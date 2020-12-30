use anyhow::Result;
use redis::{AsyncCommands, Client};
use serde::de::DeserializeOwned;
use serde::Serialize;

pub struct RedisClient(Client);

impl RedisClient {
    pub fn new(client: Client) -> Self {
        Self(client)
    }
    pub async fn set<V: Serialize>(&self, key: &str, value: &V) -> Result<()> {
        let mut con = self.0.get_async_connection().await?;
        let bytes = serde_json::to_vec(value)?;
        let _: () = con.set(key, bytes).await?;
        Ok(())
    }

    pub async fn get<V: DeserializeOwned>(&self, key: &str) -> Result<V> {
        let mut con = self.0.get_async_connection().await?;
        let bytes: Vec<u8> = con.get(key).await?;
        let value = serde_json::from_slice(&bytes)?;
        Ok(value)
    }
}
