import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type SupabaseOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function oauthClient(): SupabaseOAuth {
  return (supabase.auth as unknown as { oauth: SupabaseOAuth }).oauth;
}

function isSameOriginPath(next: string | null): next is string {
  return !!next && next.startsWith("/") && !next.startsWith("//");
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauthClient().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load authorization details");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const call = approve
        ? oauthClient().approveAuthorization(authorizationId)
        : oauthClient().denyAuthorization(authorizationId);
      const { data, error } = await call;
      if (error) {
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("No redirect returned by the authorization server.");
        return;
      }
      window.location.href = target;
    } catch (err: any) {
      setError(err?.message ?? "Authorization failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
          <h1 className="text-lg font-semibold text-destructive">授权请求无法加载</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-sm text-muted-foreground">加载中…</div>
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "外部客户端";
  const redirectUri = details.client?.redirect_uri ?? details.client?.redirect_uris?.[0];
  const scopeString: string = details.scope ?? details.requested_scopes ?? "";
  const scopes = scopeString ? scopeString.split(/\s+/).filter(Boolean) : [];

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">MCP 连接授权</div>
          <h1 className="mt-1 text-xl font-semibold">
            允许 {clientName} 连接到你的账户
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {clientName} 将能够以你的身份调用本应用启用的 MCP 工具（例如读取你的项目、工位与模块）。此授权不会绕过本应用的权限和后端策略。
          </p>
        </div>

        {redirectUri && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs break-all">
            <div className="font-medium text-foreground">重定向到</div>
            <div className="mt-1 text-muted-foreground">{redirectUri}</div>
          </div>
        )}

        {scopes.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-medium">申请的权限</div>
            <ul className="mt-1 list-disc list-inside text-muted-foreground">
              {scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            批准
          </Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>
            拒绝
          </Button>
        </div>
      </div>
    </main>
  );
}

export { isSameOriginPath };