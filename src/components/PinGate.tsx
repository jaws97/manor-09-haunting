"use client";

import { useState } from "react";

export function PinGate({ title }: { title: string }) {
  const [pin, setPin] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "wrong">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    if (res?.ok) location.reload();
    else setState("wrong");
  };

  return (
    <main className="pingate">
      <form onSubmit={submit}>
        <span>Manor 09 · keepers only</span>
        <h1>{title}</h1>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          aria-label="Host PIN"
          autoFocus
        />
        <button type="submit" disabled={!pin || state === "busy"}>
          Enter
        </button>
        {state === "wrong" && <p role="alert">The manor does not know you.</p>}
      </form>
    </main>
  );
}
