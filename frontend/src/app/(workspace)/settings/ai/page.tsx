"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Save, Trash2, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/content";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { StatusMessage } from "@/components/ui/status-message";
import { Dialog } from "@/components/shared/app-dialog";
import { aiApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import type { AiProvider } from "@/lib/api/types";

const labels: Record<AiProvider, string> = {
  volcengine: "火山引擎 Ark",
  deepseek: "DeepSeek",
  openai: "OpenAI 官方",
};

type ProviderForm = { modelId: string; apiKey: string };

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<API.AiProviderStatus[]>([]);
  const [forms, setForms] = useState<Partial<Record<AiProvider, ProviderForm>>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<AiProvider | null>(null);
  const [testing, setTesting] = useState<AiProvider | null>(null);
  const [deleting, setDeleting] = useState<AiProvider | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AiProvider | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await aiApi.listProviders();
      setProviders(result.providers);
      setForms((current) => {
        const next = { ...current };
        for (const provider of result.providers) {
          const existing = next[provider.provider];
          next[provider.provider] = {
            modelId: existing?.modelId ?? provider.modelId ?? "",
            apiKey: existing?.apiKey ?? "",
          };
        }
        return next;
      });
    } catch (cause) {
      setError(errorMessage(cause, "无法读取 AI 服务配置，请重试。"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void aiApi
      .listProviders()
      .then((result) => {
        if (!active) return;
        setProviders(result.providers);
        const next: Partial<Record<AiProvider, ProviderForm>> = {};
        for (const provider of result.providers)
          next[provider.provider] = {
            modelId: provider.modelId ?? "",
            apiKey: "",
          };
        setForms(next);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(errorMessage(cause, "无法读取 AI 服务配置，请重试。"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateForm(provider: AiProvider, next: Partial<ProviderForm>) {
    setForms((current) => ({
      ...current,
      [provider]: { modelId: "", apiKey: "", ...current[provider], ...next },
    }));
    setMessage("");
  }

  async function save(provider: AiProvider) {
    const form = forms[provider];
    if (!form) return;
    setSaving(provider);
    setError("");
    setMessage("");
    try {
      const result = await aiApi.updateProvider(provider, {
        modelId: form.modelId.trim(),
        apiKey: form.apiKey,
      });
      setProviders(result.providers);
      setForms((current) => ({
        ...current,
        [provider]: { ...form, apiKey: "" },
      }));
      setMessage(`${labels[provider]} 配置已保存。`);
    } catch (cause) {
      setError(errorMessage(cause, "保存 AI 服务配置失败，原配置已保留。"));
    } finally {
      setSaving(null);
    }
  }

  async function test(provider: AiProvider) {
    setTesting(provider);
    setError("");
    setMessage("");
    try {
      const result = await aiApi.testProvider(provider, crypto.randomUUID());
      const usage =
        result.inputTokens === null || result.outputTokens === null
          ? "服务商未返回完整 token 用量。"
          : `本次用量：输入 ${result.inputTokens}、输出 ${result.outputTokens} tokens。`;
      setMessage(`${labels[provider]} 连接成功。${usage}`);
    } catch (cause) {
      setError(
        errorMessage(cause, "连接测试失败；服务商是否已处理请求可能未知。"),
      );
    } finally {
      setTesting(null);
    }
  }

  async function remove(provider: AiProvider) {
    setDeleting(provider);
    setError("");
    setMessage("");
    try {
      await aiApi.deleteProvider(provider);
      setPendingDelete(null);
      setForms((current) => ({
        ...current,
        [provider]: { modelId: "", apiKey: "" },
      }));
      setMessage(`${labels[provider]} 配置已删除。`);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "删除 AI 服务配置失败。"));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="AI 服务"
        description="为自己的账户配置官方服务和模型。API Key 加密保存在此部署中，不会传给浏览器插件。"
      />
      {error ? <StatusMessage>{error}</StatusMessage> : null}
      {message ? (
        <StatusMessage tone="success" title="操作完成">
          {message}
        </StatusMessage>
      ) : null}
      {!loading && providers.some((provider) => !provider.encryptionReady) ? (
        <StatusMessage tone="info" title="需要部署者配置加密密钥">
          后端设置 32 字节 AI_ENCRYPTION_KEY 后，才能保存 API Key
          和加密的分析记录。其他简历功能不受影响。
        </StatusMessage>
      ) : null}
      <div className="grid gap-4">
        {providers.map((provider) => {
          const form = forms[provider.provider] ?? { modelId: "", apiKey: "" };
          const formDirty =
            form.modelId.trim() !== (provider.modelId ?? "") ||
            form.apiKey.trim().length > 0;
          const busy =
            saving === provider.provider ||
            testing === provider.provider ||
            deleting === provider.provider;
          return (
            <Card key={provider.provider}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{provider.displayName}</CardTitle>
                    <CardDescription className="mt-1">
                      {provider.protocol} · {provider.officialHost}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className="min-h-8 gap-1.5 px-2.5 text-xs"
                  >
                    <KeyRound aria-hidden />
                    {provider.configured
                      ? `已配置 · •••• ${provider.keySuffix}`
                      : "未配置"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FieldGroup className="contents">
                  <Field>
                    <FieldLabel htmlFor={`${provider.provider}-model-id`}>
                      模型或接入点 ID
                    </FieldLabel>
                    <Input
                      id={`${provider.provider}-model-id`}
                      value={form.modelId}
                      maxLength={200}
                      onChange={(event) =>
                        updateForm(provider.provider, {
                          modelId: event.target.value,
                        })
                      }
                      placeholder="填写服务商提供的模型 ID"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${provider.provider}-api-key`}>
                      API Key
                    </FieldLabel>
                    <Input
                      id={`${provider.provider}-api-key`}
                      type="password"
                      value={form.apiKey}
                      maxLength={512}
                      onChange={(event) =>
                        updateForm(provider.provider, {
                          apiKey: event.target.value,
                        })
                      }
                      placeholder={
                        provider.configured
                          ? "留空保留已保存密钥"
                          : "仅此账户使用的 API Key"
                      }
                      autoComplete="new-password"
                      spellCheck={false}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                {formDirty ? (
                  <span className="basis-full text-xs text-muted-foreground">
                    保存修改后再测试，避免使用旧模型或旧密钥。
                  </span>
                ) : null}
                <Button
                  disabled={
                    busy || !provider.encryptionReady || !form.modelId.trim()
                  }
                  onClick={() => void save(provider.provider)}
                >
                  {saving === provider.provider ? (
                    <span>保存中…</span>
                  ) : (
                    <>
                      <Save aria-hidden data-icon="inline-start" />
                      保存配置
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    busy ||
                    !provider.configured ||
                    !provider.encryptionReady ||
                    formDirty
                  }
                  onClick={() => void test(provider.provider)}
                >
                  <Zap aria-hidden data-icon="inline-start" />
                  {testing === provider.provider ? "测试中…" : "测试连接"}
                </Button>
                {provider.configured ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setPendingDelete(provider.provider)}
                  >
                    <Trash2 aria-hidden data-icon="inline-start" />
                    删除配置
                  </Button>
                ) : null}
                {provider.updateTime ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    更新于 {new Date(provider.updateTime).toLocaleString()}
                  </span>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <StatusMessage tone="info" title="调用与数据说明">
        分析前会展示实际发送的简历字段和岗位描述。输入与分析结果在此部署中加密保存
        7 天，仅当前账户可查看，到期自动清理。CVory 不限制调用次数、tokens
        或费用；模型和服务商可能产生费用。连接测试仅发送固定短提示，也可能收费。请部署者备份并长期保留
        AI_ENCRYPTION_KEY；密钥丢失或更换后，已有密文无法读取。
      </StatusMessage>
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`删除${pendingDelete ? labels[pendingDelete] : ""}配置？`}
        description="删除后，此账户将无法继续使用这项服务；7 天内已有的分析记录仍可读取并按期清理。"
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={!pendingDelete || deleting !== null}
            onClick={() => pendingDelete && void remove(pendingDelete)}
          >
            <Trash2 aria-hidden data-icon="inline-start" />
            {deleting ? "删除中…" : "确认删除"}
          </Button>
        </div>
      </Dialog>
      {loading ? (
        <StatusMessage loading tone="info">
          正在读取配置…
        </StatusMessage>
      ) : null}
      {!loading && providers.length === 0 && !error ? (
        <StatusMessage tone="info">
          <Check aria-hidden className="mr-1 inline size-4" />
          当前服务没有返回可用的 AI 预设。
        </StatusMessage>
      ) : null}
      <Button variant="ghost" disabled={loading} onClick={() => void load()}>
        重新读取
      </Button>
    </div>
  );
}
