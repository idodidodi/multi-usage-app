use tauri::{command, State, Manager};
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params};
use std::sync::Mutex;
use std::fs;
use std::path::PathBuf;

const DB_DIR: &str = "/Users/ido1/Library/CloudStorage/OneDrive-VipassanaTrust/Always keep on this device/Pulse Data";
const DB_NAME: &str = "pulse.db";

pub struct DbConnection(Mutex<Connection>);

#[derive(Serialize, Deserialize, Clone)]
pub struct StockAlert {
    pub id: String,
    pub ticker: String,
    pub target_price: f64,
    pub last_price: f64,
    pub status: String,
    pub condition: String,
    pub updated_at: String,
    pub last_sync_at: i64,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Settings {
    pub telegram_token: String,
    pub telegram_chat_id: String,
}

#[derive(Deserialize)]
struct YahooResponse {
    chart: ChartContent,
}

#[derive(Deserialize)]
struct ChartContent {
    result: Option<Vec<ChartResult>>,
    error: Option<YahooError>,
}

#[derive(Deserialize)]
struct ChartResult {
    meta: ChartMeta,
    timestamp: Option<Vec<i64>>,
    indicators: ChartIndicators,
}

#[derive(Deserialize)]
struct ChartIndicators {
    quote: Vec<ChartQuote>,
}

#[derive(Deserialize)]
struct ChartQuote {
    high: Vec<Option<f64>>,
    low: Vec<Option<f64>>,
}

#[derive(Deserialize)]
struct ChartMeta {
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: f64,
}

#[derive(Deserialize)]
struct YahooError {
    code: String,
    description: String,
}

#[derive(serde::Serialize)]
struct PriceRange {
    pub current: f64,
    pub high: f64,
    pub low: f64,
}

fn init_db() -> Connection {
    let mut path = PathBuf::from(DB_DIR);
    if !path.exists() {
        fs::create_dir_all(&path).expect("Failed to create database directory");
    }
    path.push(DB_NAME);
    
    let conn = Connection::open(path).expect("Failed to open database");
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            ticker TEXT NOT NULL,
            target_price REAL NOT NULL,
            last_price REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            condition TEXT DEFAULT 'above',
            updated_at TEXT,
            last_sync_at INTEGER
        )",
        [],
    ).expect("Failed to create alerts table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    ).expect("Failed to create settings table");

    conn
}

#[command]
async fn get_alerts(state: State<'_, DbConnection>) -> Result<Vec<StockAlert>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, ticker, target_price, last_price, status, condition, updated_at, last_sync_at FROM alerts").map_err(|e| e.to_string())?;
    let alert_iter = stmt.query_map([], |row| {
        Ok(StockAlert {
            id: row.get(0)?,
            ticker: row.get(1)?,
            target_price: row.get(2)?,
            last_price: row.get(3)?,
            status: row.get(4)?,
            condition: row.get(5)?,
            updated_at: row.get(6)?,
            last_sync_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut alerts = Vec::new();
    for alert in alert_iter {
        alerts.push(alert.map_err(|e| e.to_string())?);
    }
    Ok(alerts)
}

#[command]
async fn save_alert(state: State<'_, DbConnection>, alert: StockAlert) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO alerts (id, ticker, target_price, last_price, status, condition, updated_at, last_sync_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![alert.id, alert.ticker, alert.target_price, alert.last_price, alert.status, alert.condition, alert.updated_at, alert.last_sync_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
async fn delete_alert(state: State<'_, DbConnection>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM alerts WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
async fn get_settings(state: State<'_, DbConnection>) -> Result<Settings, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'telegram'").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let value: String = row.get(0).map_err(|e| e.to_string())?;
        serde_json::from_str(&value).map_err(|e| e.to_string())
    } else {
        Ok(Settings::default())
    }
}

#[command]
async fn save_settings(state: State<'_, DbConnection>, settings: Settings) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let value = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('telegram', ?1)",
        params![value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
async fn get_stock_price_range(ticker: String, start_time: i64) -> Result<PriceRange, String> {
    println!("Backend: Fetching range for {} since timestamp {}", ticker, start_time);
    let url = format!("https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1m&range=1d", ticker);
    let client = reqwest::Client::new();
    let response = client.get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
        .header("Accept", "*/*")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let text = response.text().await.map_err(|e| format!("Failed to get text: {}", e))?;
    let data: YahooResponse = serde_json::from_str(&text).map_err(|e| format!("Parse error: {} | Content: {}", e, text))?;
    
    if let Some(error) = data.chart.error {
        return Err(error.description);
    }

    if let Some(result) = data.chart.result.and_then(|r| r.into_iter().next()) {
        let current = result.meta.regular_market_price;
        let mut window_high = current;
        let mut window_low = current;

        if let (Some(timestamps), Some(quotes)) = (result.timestamp, result.indicators.quote.first()) {
            for (i, &ts) in timestamps.iter().enumerate() {
                if ts >= start_time {
                    if let Some(h) = quotes.high.get(i).and_then(|h| *h) {
                        if h > window_high { window_high = h; }
                    }
                    if let Some(l) = quotes.low.get(i).and_then(|l| *l) {
                        if l < window_low { window_low = l; }
                    }
                }
            }
        }
        Ok(PriceRange { current, high: window_high, low: window_low })
    } else {
        Err(format!("Ticker {} not found", ticker))
    }
}

#[command]
async fn send_telegram_notification(token: String, chat_id: String, message: String) -> Result<(), String> {
    let url = format!("https://api.telegram.org/bot{}/sendMessage", token);
    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    });
    client.post(url).json(&payload).send().await.map_err(|e| format!("Failed to send Telegram message: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(DbConnection(Mutex::new(init_db())))
    .invoke_handler(tauri::generate_handler![
        get_alerts, 
        save_alert, 
        delete_alert, 
        get_settings, 
        save_settings,
        get_stock_price_range, 
        send_telegram_notification
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
