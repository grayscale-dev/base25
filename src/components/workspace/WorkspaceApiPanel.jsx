import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Lock,
  Plus,
  Server,
  Trash2,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import Badge from "@/components/common/Badge";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StateBanner, StatePanel } from "@/components/common/StateDisplay";

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/items",
    description: "List unified items across Feedback, Roadmap, and Changelog groups",
    permissions: ["items:read"],
    params: [
      { name: "group", type: "string", description: "Filter by group (feedback, roadmap, changelog)" },
      { name: "status", type: "string", description: "Filter by status key for the selected group" },
      { name: "limit", type: "number", description: "Max items to return (default: 50)" },
    ],
    response: `{
  "data": [
    {
      "id": "it_123",
      "group_key": "feedback",
      "title": "Improve onboarding flow",
      "status_key": "planned",
      "metadata": { "type": "feature_request" },
      "created_date": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 42
}`,
  },
  {
    method: "POST",
    path: "/api/items",
    description: "Create a new unified item",
    permissions: ["items:write"],
    body: `{
  "group_key": "feedback",
  "status_key": "open",
  "title": "Bug in login page",
  "description": "Login fails on mobile browsers",
  "metadata": { "type": "bug", "priority": "high" }
}`,
    response: `{
  "id": "it_124",
  "group_key": "feedback",
  "title": "Bug in login page",
  "status_key": "open",
  "created_date": "2025-01-15T10:00:00Z"
}`,
  },
  {
    method: "PATCH",
    path: "/api/items/:id",
    description: "Update an item, including group transitions and status changes",
    permissions: ["items:write"],
    params: [{ name: "id", type: "string", description: "Item identifier" }],
    response: `{
  "id": "it_124",
  "group_key": "roadmap",
  "status_key": "in_progress",
  "metadata": { "target_quarter": "Q2 2026" }
}`,
  },
  {
    method: "GET",
    path: "/api/item-statuses",
    description: "Read status groups and statuses configured for the workspace",
    permissions: ["items:read"],
    body: `{
  "groups": [
    { "group_key": "feedback", "display_name": "Feedback" },
    { "group_key": "roadmap", "display_name": "Roadmap" },
    { "group_key": "changelog", "display_name": "Changelog" }
  ],
  "statuses": [
    { "group_key": "feedback", "status_key": "open", "label": "Open" }
  ]
}`,
    response: `{}`,
  },
];

const ALL_PERMISSIONS = [
  { value: "items:read", label: "Read Items" },
  { value: "items:write", label: "Write Items" },
  { value: "status-groups:write", label: "Manage Status Groups" },
  { value: "tokens:write", label: "Manage API Access" },
];

export default function WorkspaceApiPanel({ workspace }) {
  const workspaceId = workspace?.id || null;
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenPerms, setNewTokenPerms] = useState([]);
  const [createdToken, setCreatedToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [pendingRevokeToken, setPendingRevokeToken] = useState(null);
  const [revokingTokenId, setRevokingTokenId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    void loadTokens();
  }, [workspaceId]);

  const loadTokens = async () => {
    if (!workspaceId) return;
    try {
      setLoadError("");
      setLoading(true);
      const tokenData = await base44.entities.ApiToken.filter({ workspace_id: workspaceId });
      setTokens(tokenData || []);
    } catch (error) {
      console.error("Failed to load API tokens:", error);
      setLoadError("Unable to load API tokens right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName || newTokenPerms.length === 0 || !workspaceId) return;
    try {
      setActionError("");
      const user = await base44.auth.me();
      const tokenValue = "itms_" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      await base44.entities.ApiToken.create({
        workspace_id: workspaceId,
        name: newTokenName,
        token_hash: tokenValue,
        token_prefix: tokenValue.slice(0, 12),
        permissions: newTokenPerms,
        rate_limit: 1000,
        is_active: true,
        created_by: user.email,
      });

      setCreatedToken(tokenValue);
      setNewTokenName("");
      setNewTokenPerms([]);
      await loadTokens();
    } catch (error) {
      console.error("Failed to create token:", error);
      setActionError("Failed to create API token. Please try again.");
    }
  };

  const handleRevokeToken = async () => {
    if (!pendingRevokeToken?.id) return;
    setActionError("");
    setRevokingTokenId(pendingRevokeToken.id);
    try {
      await base44.entities.ApiToken.delete(pendingRevokeToken.id);
      await loadTokens();
      toast({
        title: "Token revoked",
        description: `${pendingRevokeToken.name} was removed.`,
      });
    } catch (error) {
      console.error("Failed to revoke token:", error);
      setActionError("Failed to revoke API token. Please try again.");
    } finally {
      setRevokingTokenId(null);
      setPendingRevokeToken(null);
    }
  };

  const togglePermission = (permission) => {
    setNewTokenPerms((prev) =>
      prev.includes(permission)
        ? prev.filter((value) => value !== permission)
        : [...prev, permission]
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Token copied to clipboard.",
    });
  };

  if (loading) {
    return <PageLoadingState text="Loading API settings..." />;
  }

  if (loadError) {
    return (
      <StatePanel
        tone="danger"
        title="API settings unavailable"
        description={loadError}
        action={() => {
          void loadTokens();
        }}
        actionLabel="Retry"
      />
    );
  }

  return (
    <div className="space-y-6">
      <StateBanner tone="danger" message={actionError} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>API Access</CardTitle>
            <CardDescription>Manage API tokens for this workspace.</CardDescription>
          </div>
          <Button onClick={() => setShowCreateToken(true)} className="bg-slate-900 hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" />
            Create Token
          </Button>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No API tokens created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell>
                      <code className="text-sm text-slate-500">{token.token_prefix}...</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {token.permissions?.slice(0, 2).map((permission) => (
                          <Badge key={permission} variant="outline" size="sm">
                            {permission}
                          </Badge>
                        ))}
                        {token.permissions?.length > 2 ? (
                          <Badge variant="outline" size="sm">
                            +{token.permissions.length - 2}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(token.created_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingRevokeToken(token)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={revokingTokenId === token.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>All API requests require a Bearer token.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg bg-slate-900 p-4">
            <code className="text-sm text-slate-100">Authorization: Bearer YOUR_API_TOKEN</code>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <Zap className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Rate limit: 1,000 requests per hour per token</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Base URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg bg-slate-900 p-4">
            <code className="text-sm text-slate-100">
              https://api.yourplatform.com/v1/workspaces/{workspace?.id}
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            API Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {API_ENDPOINTS.map((endpoint, index) => (
            <Collapsible
              key={`${endpoint.method}:${endpoint.path}`}
              open={expandedEndpoint === index}
              onOpenChange={() => setExpandedEndpoint(expandedEndpoint === index ? null : index)}
            >
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer rounded-lg bg-slate-50 p-4 transition-colors hover:bg-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={endpoint.method === "GET" ? "primary" : "success"}
                        className="font-mono text-xs"
                      >
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm font-medium text-slate-700">{endpoint.path}</code>
                    </div>
                    {expandedEndpoint === index ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{endpoint.description}</p>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pt-4">
                <div className="space-y-4 pb-4">
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-slate-700">Required Permissions</h4>
                    <div className="flex gap-2">
                      {endpoint.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="font-mono text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {endpoint.params ? (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-slate-700">Query Parameters</h4>
                      <div className="space-y-2">
                        {endpoint.params.map((param) => (
                          <div key={param.name} className="flex gap-4 text-sm">
                            <code className="text-blue-600">{param.name}</code>
                            <span className="text-slate-400">{param.type}</span>
                            <span className="text-slate-600">{param.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {endpoint.body ? (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-slate-700">Request Body</h4>
                      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
                        {endpoint.body}
                      </pre>
                    </div>
                  ) : null}

                  <div>
                    <h4 className="mb-2 text-sm font-medium text-slate-700">Response</h4>
                    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
                      {endpoint.response}
                    </pre>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      <Dialog open={showCreateToken} onOpenChange={setShowCreateToken}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Token</DialogTitle>
          </DialogHeader>

          {createdToken ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="mb-2 text-sm text-emerald-700">
                  Token created successfully. Copy it now because it will not be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded border border-emerald-200 bg-white p-2 text-sm">
                    {createdToken}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(createdToken)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowCreateToken(false);
                    setCreatedToken(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label>Token Name</Label>
                  <Input
                    value={newTokenName}
                    onChange={(event) => setNewTokenName(event.target.value)}
                    placeholder="e.g., CI/CD Pipeline"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="mt-2 space-y-2">
                    {ALL_PERMISSIONS.map((permission) => (
                      <div key={permission.value} className="flex items-center gap-2">
                        <Checkbox
                          id={permission.value}
                          checked={newTokenPerms.includes(permission.value)}
                          onCheckedChange={() => togglePermission(permission.value)}
                        />
                        <label htmlFor={permission.value} className="cursor-pointer text-sm text-slate-700">
                          {permission.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreateToken(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateToken}
                  disabled={!newTokenName || newTokenPerms.length === 0}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  Create Token
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingRevokeToken)}
        onOpenChange={(open) => !open && setPendingRevokeToken(null)}
        title="Revoke API Token"
        description={
          pendingRevokeToken
            ? `Revoke "${pendingRevokeToken.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel={revokingTokenId ? "Revoking..." : "Revoke Token"}
        onConfirm={() => {
          void handleRevokeToken();
        }}
        loading={Boolean(revokingTokenId)}
      />
    </div>
  );
}
