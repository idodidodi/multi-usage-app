use tauri::command;
use serde::Deserialize;

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

#[command]
async fn get_stock_price(ticker: String) -> Result<f64, String> {
    println!("Backend: Fetching ticker -> {}", ticker);
    
    // Using v8 chart API which is more reliable for public access
    let url = format!("https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1m&range=1d", ticker);
    
    let client = reqwest::Client::new();
    let response = client.get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
        .header("Accept", "*/*")
        .header("Origin", "https://finance.yahoo.com")
        .header("Referer", "https://finance.yahoo.com/")
        .send()
        .await
        .map_err(|e| {
            println!("Backend: Request error -> {}", e);
            format!("Request failed: {}", e)
        })?;

    let status = response.status();
    let text = response.text().await.map_err(|e| {
        println!("Backend: Text error -> {}", e);
        format!("Failed to get text: {}", e)
    })?;

    if !status.is_success() {
        println!("Backend: Bad Status -> {} | Body: {}", status, text);
        return Err(format!("Bad status {}: {}", status, text));
    }

    let data: YahooResponse = match serde_json::from_str(&text) {
        Ok(d) => d,
        Err(e) => {
            println!("Backend: JSON parse error -> {}", e);
            return Err(format!("Parse error: {} | Body: {}", e, if text.len() > 100 { &text[..100] } else { &text }));
        }
    };
    
    if let Some(error) = data.chart.error {
        println!("Backend: API Error -> {}", error.description);
        return Err(error.description);
    }

    if let Some(result) = data.chart.result.and_then(|r| r.into_iter().next()) {
        let price = result.meta.regular_market_price;
        println!("Backend: Success -> {} = ${}", ticker, price);
        Ok(price)
    } else {
        println!("Backend: No result found for {}", ticker);
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

    client.post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send Telegram message: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![get_stock_price, send_telegram_notification])
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
