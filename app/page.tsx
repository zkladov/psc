"use client";
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const LS_KEY = "PSC_STATE_V1";

const defaultSettings = {
  fxLeverage: 30,
  goldLeverage: 9,
  eurusdRate: 1.1,
  ger40PointValueEUR: 1,
  ger40Leverage: 15,
};

const instruments = [
  { id: "EURUSD", label: "EURUSD (FX)", kind: "fx", pipSize: 0.0001 },
  { id: "GBPUSD", label: "GBPUSD (FX)", kind: "fx", pipSize: 0.0001 },
  { id: "XAUUSD", label: "XAUUSD (Gold)", kind: "gold" },
  { id: "GER40", label: "GER40 (DAX)", kind: "ger40" },
];

function usePersistentState() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      showSettings: false,
      settings: defaultSettings,
      inputs: {
        instrument: "EURUSD",
        entry: "1.585",
        stopLoss: "1.58",
        riskUSD: "500",
        direction: "auto",
      },
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  return [state, setState];
}

function numberOrZero(v) {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function compute({ instrument, entry, stopLoss, riskUSD, direction }, settings) {
  const A = numberOrZero(entry);
  const B = numberOrZero(stopLoss);
  const C = numberOrZero(riskUSD);
  const delta = Math.abs(A - B);

  let dir = direction;
  if (dir === "auto") dir = A > B ? "long" : "short";

  let F = 0;
  let lots = 0;
  let marginPerLot = 0;

  const rewardUSD = 2 * C;
  const takeProfit = dir === "long" ? A + 2 * Math.abs(A - B) : A - 2 * Math.abs(A - B);

  const kind = instruments.find(x => x.id === instrument)?.kind;

  if (kind === "fx") {
    const pipSize = instruments.find(x => x.id === instrument)?.pipSize || 0.0001;
    F = delta / pipSize;
    lots = F > 0 ? C / (F * 10) : 0;
    marginPerLot = A > 0 ? (A * 100000) / numberOrZero(settings.fxLeverage) : 0;
  } else if (kind === "gold") {
    F = delta;
    lots = F > 0 ? C / (F * 100) : 0;
    marginPerLot = A > 0 ? (A * 100) / numberOrZero(settings.goldLeverage) : 0;
  } else if (kind === "ger40") {
    F = delta;
    const eurusd = numberOrZero(settings.eurusdRate);
    const leverage = numberOrZero(settings.ger40Leverage);
    const marginEUR = A > 0 ? A / leverage : 0;
    marginPerLot = marginEUR * eurusd;
    const pointEUR = numberOrZero(settings.ger40PointValueEUR);
    lots = F > 0 ? C / (F * eurusd * pointEUR) : 0;
  }

  const requiredMargin = lots * marginPerLot;

  return {
    delta,
    distance: F,
    lots,
    marginPerLot,
    requiredMargin,
    rewardUSD,
    takeProfit,
    direction: dir,
  };
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatBox({ label, value, decimals = 2 }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(value || 0)}</div>
    </div>
  );
}

export default function App() {
  const [state, setState] = usePersistentState();
  const { settings, inputs, showSettings } = state;
  const result = useMemo(() => compute(inputs, settings), [inputs, settings]);

  function setInput(k, v) {
    setState(s => ({ ...s, inputs: { ...s.inputs, [k]: v } }));
  }
  function setSetting(k, v) {
    setState(s => ({ ...s, settings: { ...s.settings, [k]: v } }));
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto max-w-4xl grid gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Position Size Calculator</h1>
          <Button variant="secondary" onClick={() => setState(s => ({ ...s, showSettings: !s.showSettings }))}>
            {showSettings ? "Close Settings" : "Settings"}
          </Button>
        </header>

        {showSettings && (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 md:p-6 grid gap-4">
              <h2 className="text-lg font-medium">Global Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="FX Leverage (EURUSD/GBPUSD)">
                  <Input inputMode="decimal" value={settings.fxLeverage} onChange={e => setSetting("fxLeverage", e.target.value)} />
                </Field>
                <Field label="Gold Leverage (XAUUSD)">
                  <Input inputMode="decimal" value={settings.goldLeverage} onChange={e => setSetting("goldLeverage", e.target.value)} />
                </Field>
                <Field label="GER40 Leverage (GER40USD)">
                  <Input inputMode="decimal" value={settings.ger40Leverage} onChange={e => setSetting("ger40Leverage", e.target.value)} />
                </Field>
                <Field label="GER40 point value (EUR/pt/lot)">
                  <Input inputMode="decimal" value={settings.ger40PointValueEUR} onChange={e => setSetting("ger40PointValueEUR", e.target.value)} />
                </Field>
                <Field label="EURUSD rate (for GER40 conversion)">
                  <Input inputMode="decimal" value={settings.eurusdRate} onChange={e => setSetting("eurusdRate", e.target.value)} />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setState(s => ({ ...s, settings: defaultSettings }))}>Reset to defaults</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4 md:p-6 grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Pair / Instrument">
                <Select value={inputs.instrument} onValueChange={v => setInput("instrument", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select instrument" />
                  </SelectTrigger>
                  <SelectContent>
                    {instruments.map(x => (
                      <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Direction">
                <Select value={inputs.direction} onValueChange={v => setInput("direction", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (by Entry vs SL)</SelectItem>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Entry">
                <Input inputMode="decimal" value={inputs.entry} onChange={e => setInput("entry", e.target.value)} />
              </Field>
              <Field label="Stop Loss (SL)">
                <Input inputMode="decimal" value={inputs.stopLoss} onChange={e => setInput("stopLoss", e.target.value)} />
              </Field>
              <Field label="Risk ($)">
                <Input inputMode="decimal" value={inputs.riskUSD} onChange={e => setInput("riskUSD", e.target.value)} />
              </Field>
              <Field label="Computed direction">
                <Input readOnly value={result.direction.toUpperCase()} />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatBox label="Distance (pips/$/pts)" value={result.distance} decimals={2} />
              <StatBox label="Position Size (lots)" value={result.lots} decimals={3} />
              <StatBox label="Margin per 1 lot ($)" value={result.marginPerLot} decimals={2} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatBox label="Required Margin ($)" value={result.requiredMargin} decimals={2} />
              <StatBox label="Reward ($)" value={result.rewardUSD} decimals={2} />
              <StatBox label="TP price (R/R 1:2)" value={result.takeProfit} decimals={3} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
