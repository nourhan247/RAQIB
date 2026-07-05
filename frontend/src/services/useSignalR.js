import { useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";

export function useSignalR(onAiReply, onMapUpdate, onNewReport) {
  const connRef = useRef(null);

  const connect = useCallback(async () => {
    const token = localStorage.getItem("raqib_token");
    if (!token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7212/hubs/notifications", {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    conn.on("AiReply",   onAiReply);
    conn.on("MapUpdate", onMapUpdate);
    conn.on("NewReport", onNewReport);

    await conn.start();
    connRef.current = conn;
  }, [onAiReply, onMapUpdate, onNewReport]);

  useEffect(() => {
    connect();
    return () => { connRef.current?.stop(); };
  }, [connect]);
}
