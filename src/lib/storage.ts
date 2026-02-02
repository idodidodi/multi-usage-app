import { invoke } from "@tauri-apps/api/core";

export interface StockAlert {
    id: string;
    ticker: string;
    targetPrice: number;
    lastPrice: number;
    status: "active" | "triggered";
    condition: "above" | "below";
    updatedAt: string;
    lastSyncAt: number;
}

export interface Settings {
    telegramToken: string;
    telegramChatId: string;
}

export const storage = {
    getSettings: async (): Promise<Settings> => {
        try {
            const raw = await invoke<any>("get_settings");
            return {
                telegramToken: raw.telegram_token || "",
                telegramChatId: raw.telegram_chat_id || ""
            };
        } catch (e) {
            console.error("Failed to fetch settings", e);
            return { telegramToken: "", telegramChatId: "" };
        }
    },

    saveSettings: async (settings: Settings) => {
        await invoke("save_settings", {
            settings: {
                telegram_token: settings.telegramToken,
                telegram_chat_id: settings.telegramChatId
            }
        });
    },

    getAlerts: async (): Promise<StockAlert[]> => {
        try {
            const raw: any[] = await invoke("get_alerts");
            return raw.map(r => ({
                id: r.id,
                ticker: r.ticker,
                targetPrice: r.target_price,
                lastPrice: r.last_price,
                status: r.status as any,
                condition: r.condition as any,
                updatedAt: r.updated_at,
                lastSyncAt: r.last_sync_at
            }));
        } catch (e) {
            console.error("Failed to fetch alerts", e);
            return [];
        }
    },

    saveAlert: async (ticker: string, targetPrice: number, condition: "above" | "below" = "above") => {
        const newAlert: StockAlert = {
            id: Math.random().toString(36).substring(2, 9),
            ticker: ticker.toUpperCase(),
            targetPrice,
            lastPrice: 0,
            status: "active",
            condition,
            updatedAt: new Date().toISOString(),
            lastSyncAt: Math.floor(Date.now() / 1000)
        };

        await invoke("save_alert", {
            alert: {
                id: newAlert.id,
                ticker: newAlert.ticker,
                target_price: newAlert.targetPrice,
                last_price: newAlert.lastPrice,
                status: newAlert.status,
                condition: newAlert.condition,
                updated_at: newAlert.updatedAt,
                last_sync_at: newAlert.lastSyncAt
            }
        });
        return newAlert;
    },

    updateAlertPrice: async (id: string, currentPrice: number, rangeLow?: number, rangeHigh?: number) => {
        const alerts = await storage.getAlerts();
        const alert = alerts.find(a => a.id === id);
        if (!alert) return;

        let triggered = false;
        if (alert.condition === "above") {
            triggered = currentPrice >= alert.targetPrice || (rangeHigh !== undefined && rangeHigh >= alert.targetPrice);
        } else {
            triggered = currentPrice <= alert.targetPrice || (rangeLow !== undefined && rangeLow <= alert.targetPrice);
        }

        const updated = {
            ...alert,
            lastPrice: currentPrice,
            status: triggered ? "triggered" : alert.status,
            updatedAt: new Date().toISOString(),
            lastSyncAt: Math.floor(Date.now() / 1000)
        };

        await invoke("save_alert", {
            alert: {
                id: updated.id,
                ticker: updated.ticker,
                target_price: updated.targetPrice,
                last_price: updated.lastPrice,
                status: updated.status,
                condition: updated.condition,
                updated_at: updated.updatedAt,
                last_sync_at: updated.lastSyncAt
            }
        });
    },

    updateAlert: async (id: string, ticker: string, targetPrice: number, condition: "above" | "below") => {
        const alerts = await storage.getAlerts();
        const alert = alerts.find(a => a.id === id);
        if (!alert) return;

        const updated = {
            ...alert,
            ticker: ticker.toUpperCase(),
            targetPrice,
            condition,
            updatedAt: new Date().toISOString(),
        };

        await invoke("save_alert", {
            alert: {
                id: updated.id,
                ticker: updated.ticker,
                target_price: updated.targetPrice,
                last_price: updated.lastPrice,
                status: updated.status,
                condition: updated.condition,
                updated_at: updated.updatedAt,
                last_sync_at: updated.lastSyncAt
            }
        });
    },

    deleteAlert: async (id: string) => {
        await invoke("delete_alert", { id });
    }
};
