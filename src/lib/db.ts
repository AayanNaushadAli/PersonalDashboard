import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "virtual_db.json");

export interface VirtualTrade {
    id: number;
    symbol: string;
    side: "buy" | "sell";
    price: number;
    size: number;
    notional: number;
    date: string;
    leverage?: number;
    is_bot?: boolean;
}

export interface VirtualDBState {
    balance: number;
    trades: VirtualTrade[];
}

const DEFAULT_STATE: VirtualDBState = {
    balance: 100.0,
    trades: [],
};

// Ensure File exists
function initDB() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    }
}

export function readDB(): VirtualDBState {
    initDB();
    try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
    } catch {
        return DEFAULT_STATE;
    }
}

export function writeDB(state: VirtualDBState) {
    initDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

export function recordVirtualTrade(tradeObj: Omit<VirtualTrade, "id" | "date" | "notional">) {
    const state = readDB();
    
    const notional = tradeObj.price * tradeObj.size;
    const newBalance = tradeObj.side === "buy" ? state.balance - notional : state.balance + notional;
    
    const newTrade: VirtualTrade = {
        ...tradeObj,
        id: Date.now(),
        date: new Date().toLocaleString(),
        notional
    };

    state.balance = newBalance;
    state.trades.unshift(newTrade); // Add to top

    writeDB(state);
    return state;
}

export function resetVirtualDB() {
    writeDB(DEFAULT_STATE);
    return DEFAULT_STATE;
}
