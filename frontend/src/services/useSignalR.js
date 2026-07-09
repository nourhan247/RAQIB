import { useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { BASE_URL } from "./api";


export function useSignalR(onAiReply, onMapUpdate, onNewReport, onNotification) {
  const connRef = useRef(null);

  const connect = useCallback(async () => {
    const token = localStorage.getItem("raqib_token");
    if (!token) return;

    // اقفل أي اتصال قديم
    if (connRef.current) {
      await connRef.current.stop();
      connRef.current = null;
    }

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/notifications`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();


    conn.off("AiReply");
    conn.off("MapUpdate");
    conn.off("NewReport");
    conn.off("Notification");


    conn.on("AiReply", (payload) => {
      console.log("AI Reply Received", payload);
      onAiReply(payload);
    });

    conn.on("MapUpdate", (payload) => {
      onMapUpdate(payload);
    });

    conn.on("NewReport", (payload) => {
      onNewReport(payload);
    });

    // ── NEW: notification bell (e.g. "report resolved") ──
    conn.on("Notification", (payload) => {
      if (typeof onNotification === "function") onNotification(payload);
    });


    await conn.start();

    console.log("SignalR Connected");

    connRef.current = conn;

  }, [onAiReply, onMapUpdate, onNewReport, onNotification]);


  useEffect(() => {
    connect();

    return () => {
      if (connRef.current) {
        connRef.current.stop();
      }
    };

  }, [connect]);
}
