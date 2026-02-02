"use client";

export interface StockAlert {
    id: string;
    ticker: string;
    targetPrice: number;
    lastPrice: number;
    status: "active" | "triggered";
    updatedAt: string;
}

const STOCK_ALERTS_KEY = "pulse_stock_alerts";

export const storage = {
    getAlerts: (): StockAlert[] => {
        if (typeof window === "undefined") return [];
        const stored = localStorage.getItem(STOCK_ALERTS_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    saveAlert: (ticker: string, targetPrice: number) => {
        const alerts = storage.getAlerts();
        const newAlert: StockAlert = {
            id: Math.random().toString(36).substring(2, 9),
            ticker: ticker.toUpperCase(),
            targetPrice,
            lastPrice: 0,
            status: "active",
            updatedAt: new Date().toISOString(),
        };
        alerts.push(newAlert);
        localStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(alerts));
        return newAlert;
    },

    updateAlertPrice: (id: string, currentPrice: number) => {
        const alerts = storage.getAlerts().map((alert) => {
            if (alert.id === id) {
                const triggered = currentPrice >= alert.targetPrice;
                return {
                    ...alert,
                    lastPrice: currentPrice,
                    status: triggered ? "triggered" : alert.status,
                    updatedAt: new Date().toISOString(),
                };
            }
            return alert;
        });
        localStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(alerts));
    },

    deleteAlert: (id: string) => {
        const alerts = storage.getAlerts().filter((a) => a.id !== id);
        localStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(alerts));
    }
};
