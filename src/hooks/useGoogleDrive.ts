import { useState, useCallback } from "react";

const FOLDER_NAME = "MercadoApp";
const MAX_BACKUPS = 10;
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_KEY = "mkt3_google_access_token";
const TOKEN_EXPIRY_KEY = "mkt3_google_token_expiry";

export type DriveStatus =
  | { type: "idle" }
  | { type: "loading"; msg: string }
  | { type: "success"; msg: string }
  | { type: "error"; msg: string }
  | { type: "confirm"; msg: string; fileName: string; date: string; onConfirm: () => void };

function saveToken(token: string, expiresIn: number) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
  } catch {}
}

function loadToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || "0");
    if (token && Date.now() < expiry - 60_000) return token;
    return null;
  } catch {
    return null;
  }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {}
}

export function useGoogleDrive(clientId: string) {
  const [status, setStatus] = useState<DriveStatus>({ type: "idle" });
  const [accessToken, setAccessToken] = useState<string | null>(() => loadToken());
  const isLoggedIn = Boolean(accessToken);

  // ── Sign in ────────────────────────────────────────────────────────────────
  const signIn = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      const existing = loadToken();
      if (existing) { setAccessToken(existing); resolve(existing); return; }

      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) { reject(new Error(resp.error)); return; }
          saveToken(resp.access_token, resp.expires_in);
          setAccessToken(resp.access_token);
          resolve(resp.access_token);
        },
      });
      if (!client) { reject(new Error("Google Identity Services não carregado.")); return; }
      client.requestAccessToken();
    });
  }, [clientId]);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    if (accessToken) {
      try { (window as any).google?.accounts?.oauth2?.revoke(accessToken); } catch {}
    }
    clearToken();
    setAccessToken(null);
    setStatus({ type: "idle" });
  }, [accessToken]);

  // ── Drive helpers ──────────────────────────────────────────────────────────
  async function driveRequest(url: string, options: RequestInit, token: string) {
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...((options.headers as object) || {}) },
    });
    if (res.status === 401) { clearToken(); setAccessToken(null); throw new Error("Sessão expirada. Faça login novamente."); }
    if (!res.ok) { const t = await res.text(); throw new Error(`Erro Drive API: ${res.status} ${t}`); }
    return res;
  }

  async function getOrCreateFolder(token: string): Promise<string> {
    // Search for existing folder
    const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {}, token);
    const data = await res.json();
    if (data.files?.length > 0) return data.files[0].id;

    // Create folder
    const createRes = await driveRequest(
      "https://www.googleapis.com/drive/v3/files",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
      },
      token
    );
    const folder = await createRes.json();
    return folder.id;
  }

  async function listBackups(token: string, folderId: string) {
    const q = encodeURIComponent(`'${folderId}' in parents and name contains 'mercadoapp-backup' and trashed=false`);
    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&orderBy=createdTime desc`,
      {},
      token
    );
    const data = await res.json();
    return (data.files || []) as { id: string; name: string; createdTime: string }[];
  }

  async function pruneOldBackups(token: string, files: { id: string; name: string; createdTime: string }[]) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      await driveRequest(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: "DELETE" }, token);
    }
  }

  // ── Backup to Drive ────────────────────────────────────────────────────────
  const backupToDrive = useCallback(async (backupData: object) => {
    setStatus({ type: "loading", msg: "Conectando ao Google Drive..." });
    try {
      const token = await signIn();
      setStatus({ type: "loading", msg: "Salvando backup..." });

      const folderId = await getOrCreateFolder(token);
      const now = new Date();
      const fileName = `mercadoapp-backup-${now.toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });

      // Multipart upload
      const boundary = "foo_bar_baz";
      const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
      const body = [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${await blob.text()}\r\n`,
        `--${boundary}--`,
      ].join("");

      await driveRequest(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
          body,
        },
        token
      );

      // Prune old backups
      const files = await listBackups(token, folderId);
      await pruneOldBackups(token, files);

      setStatus({ type: "success", msg: `Backup salvo no Drive: ${fileName}` });
      setTimeout(() => setStatus({ type: "idle" }), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setStatus({ type: "error", msg });
      setTimeout(() => setStatus({ type: "idle" }), 5000);
    }
  }, [signIn]);

  // ── Sync from Drive ────────────────────────────────────────────────────────
  const syncFromDrive = useCallback(async (onImport: (data: object) => void) => {
    setStatus({ type: "loading", msg: "Conectando ao Google Drive..." });
    try {
      const token = await signIn();
      setStatus({ type: "loading", msg: "Buscando backups..." });

      const folderId = await getOrCreateFolder(token);
      const files = await listBackups(token, folderId);

      if (files.length === 0) {
        setStatus({ type: "error", msg: "Nenhum backup encontrado na pasta MercadoApp." });
        setTimeout(() => setStatus({ type: "idle" }), 4000);
        return;
      }

      const latest = files[0];
      const dateLabel = new Date(latest.createdTime).toLocaleString("pt-BR");

      // Ask user to confirm before importing
      setStatus({
        type: "confirm",
        msg: `Sincronizar com o backup mais recente?`,
        fileName: latest.name,
        date: dateLabel,
        onConfirm: async () => {
          setStatus({ type: "loading", msg: "Importando dados..." });
          try {
            const res = await driveRequest(
              `https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media`,
              {},
              token
            );
            const data = await res.json();
            onImport(data);
            setStatus({ type: "success", msg: `Dados sincronizados com backup de ${dateLabel}` });
            setTimeout(() => setStatus({ type: "idle" }), 4000);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Erro ao importar";
            setStatus({ type: "error", msg });
            setTimeout(() => setStatus({ type: "idle" }), 5000);
          }
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setStatus({ type: "error", msg });
      setTimeout(() => setStatus({ type: "idle" }), 5000);
    }
  }, [signIn]);

  return { isLoggedIn, status, setStatus, signIn, signOut, backupToDrive, syncFromDrive };
}
