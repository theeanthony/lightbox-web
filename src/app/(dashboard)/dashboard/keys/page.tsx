"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, AlertTriangle, Key } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load Keys on Mount
  useEffect(() => {
    fetch("/api/keys")
      .then((res) => res.json())
      .then((data) => setKeys(data.keys || []));
  }, []);

  const createKey = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: `Key ${keys.length + 1}` }),
      });
      const data = await res.json();
      setKeys((prev) => [data.meta, ...prev]);
      setNewKey(data.secretKey); // 🟢 Show the secret key once
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteKey = async (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
  };

  const copyToClipboard = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">API Keys</h1>
          <p className="text-muted-foreground">
            Manage authentication keys for your applications.
          </p>
        </div>
        <button
          onClick={createKey}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : <Plus className="w-4 h-4" />}
          Create New Key
        </button>
      </div>

      {/* 🟢 SECRET KEY REVEAL (Only visible after creation) */}
      {newKey && (
        <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-lg animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 text-green-600 font-semibold mb-2">
            <Check className="w-5 h-5" /> Key Created Successfully
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Copy this key now. You will <strong className="text-foreground">not</strong> be able to see it again!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background border border-green-500/30 p-3 rounded-md font-mono text-sm text-foreground break-all">
              {newKey}
            </code>
            <button
              onClick={copyToClipboard}
              className="p-3 bg-background border border-green-500/30 rounded-md hover:bg-green-500/10 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* WARNING BOX */}
      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg flex gap-3 text-orange-600 dark:text-orange-400">
        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-1">Security Notice</p>
          Do not share your API key. If a key is leaked, revoke it immediately.
        </div>
      </div>

      {/* KEY LIST */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {keys.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
             <div className="p-4 bg-muted rounded-full mb-4"><Key className="w-6 h-6 opacity-50"/></div>
             <p>No API keys generated yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Token</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((key) => (
                <tr key={key.id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{key.name}</td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">
                    {key.prefix}...********
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-2"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}