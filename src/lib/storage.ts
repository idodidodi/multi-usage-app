"use client";

export interface TrackedItem {
    id: string;
    name: string;
    url: string;
    lastValue: string;
    updatedAt: string;
}

export interface Task {
    id: string;
    name: string;
    itemId: string;
    condition: "contains" | "equals" | "gt" | "lt";
    threshold: string;
    status: "pending" | "triggered";
}

const STORAGE_KEY = "pulse_tracked_items";
const TASKS_KEY = "pulse_tasks";


export const storage = {
    getItems: (): TrackedItem[] => {
        if (typeof window === "undefined") return [];
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    saveItem: (item: Omit<TrackedItem, "id" | "updatedAt">) => {
        const items = storage.getItems();
        const newItem: TrackedItem = {
            ...item,
            id: Math.random().toString(36).substring(2, 9),
            updatedAt: new Error().stack?.includes("page") ? new Date().toISOString() : new Date().toISOString(), // Simpler timestamp
        };
        newItem.updatedAt = new Date().toISOString();
        items.push(newItem);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        return newItem;
    },

    deleteItem: (id: string) => {
        const items = storage.getItems().filter((i) => i.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    },

    updateItemValue: (id: string, value: string) => {
        const items = storage.getItems().map((i) =>
            i.id === id ? { ...i, lastValue: value, updatedAt: new Date().toISOString() } : i
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        storage.evaluateTasks();
    },

    getTasks: (): Task[] => {
        if (typeof window === "undefined") return [];
        const stored = localStorage.getItem(TASKS_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    saveTask: (task: Omit<Task, "id" | "status">) => {
        const tasks = storage.getTasks();
        const newTask: Task = {
            ...task,
            id: Math.random().toString(36).substring(2, 9),
            status: "pending"
        };
        tasks.push(newTask);
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        return newTask;
    },

    evaluateTasks: () => {
        const items = storage.getItems();
        const tasks = storage.getTasks();
        let changed = false;

        const updatedTasks = tasks.map((task) => {
            const item = items.find((i) => i.id === task.itemId);
            if (!item) return task;

            let triggered = false;
            const val = item.lastValue;
            const thr = task.threshold;

            if (task.condition === "contains") triggered = val.includes(thr);
            else if (task.condition === "equals") triggered = val === thr;
            else if (task.condition === "gt") triggered = parseFloat(val) > parseFloat(thr);
            else if (task.condition === "lt") triggered = parseFloat(val) < parseFloat(thr);

            if (triggered && task.status !== "triggered") {
                changed = true;
                return { ...task, status: "triggered" as const };
            }
            return task;
        });

        if (changed) {
            localStorage.setItem(TASKS_KEY, JSON.stringify(updatedTasks));
        }
    }
};
