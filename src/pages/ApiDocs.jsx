import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Key, Plus, Copy, Eye, EyeOff, Trash2, 
  Check, Code, ChevronDown, ChevronRight,
  FileCode, Server, Lock, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import Badge from '@/components/common/Badge';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { format } from 'date-fns';

const API_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/feedback',
    description: 'List all feedback items',
    permissions: ['feedback:read'],
    params: [
      { name: 'status', type: 'string', description: 'Filter by status' },
      { name: 'type', type: 'string', description: 'Filter by type (bug, feature_request, etc.)' },
      { name: 'limit', type: 'number', description: 'Max items to return (default: 50)' },
    ],
    response: `{
  "data": [
    {
      "id": "fb_123",
      "title": "Add dark mode",
      "type": "feature_request",
      "status": "planned",
      "created_date": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 42
}`
  },
  {
    method: 'POST',
    path: '/api/feedback',
    description: 'Create a new feedback item',
    permissions: ['feedback:write'],
    body: `{
  "title": "Bug in login page",
  "type": "bug",
  "description": "Login fails on mobile browsers"
}`,
    response: `{
  "id": "fb_124",
  "title": "Bug in login page",
  "type": "bug",
  "status": "open",
  "created_date": "2025-01-15T10:00:00Z"
}`
  },
  {
    method: 'GET',
    path: '/api/roadmap',
    description: 'List all roadmap items',
    permissions: ['roadmap:read'],
    params: [
      { name: 'status', type: 'string', description: 'Filter by status (planned, in_progress, shipped)' },
    ],
    response: `{
  "data": [
    {
      "id": "rm_123",
      "title": "Dark mode support",
      "status": "in_progress",
      "target_quarter": "Q1 2025"
    }
  ]
}`
  },
  {
    method: 'POST',
    path: '/api/roadmap',
    description: 'Create a new roadmap item',
    permissions: ['roadmap:write'],
    body: `{
  "title": "New feature",
  "description": "Feature description",
  "status": "planned",
  "target_quarter": "Q2 2025"
}`,
    response: `{
  "id": "rm_124",
  "title": "New feature",
  "status": "planned"
}`
  },
  {
    method: 'GET',
    path: '/api/support',
    description: 'List support threads',
    permissions: ['support:read'],
    params: [
      { name: 'status', type: 'string', description: 'Filter by status' },
    ],
    response: `{
  "data": [
    {
      "id": "st_123",
      "subject": "Help with setup",
      "status": "open",
      "message_count": 3
    }
  ]
}`
  },
  {
    method: 'POST',
    path: '/api/support',
    description: 'Create a new support thread',
    permissions: ['support:write'],
    body: `{
  "subject": "Need help with integration",
  "message": "I'm having trouble connecting..."
}`,
    response: `{
  "id": "st_124",
  "subject": "Need help with integration",
  "status": "open"
}`
  },
];

export default function ApiDocs() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenPerms, setNewTokenPerms] = useState([]);
  const [createdToken, setCreatedToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);

  useEffect(() => {
    const storedWorkspace = sessionStorage.getItem('selectedBoard');
    const storedRole = sessionStorage.getItem('currentRole');
    
    if (!storedWorkspace || storedRole !== 'admin') {
      navigate(createPageUrl('Feedback'));
      return;
    }
    
    setWorkspace(JSON.parse(storedWorkspace));
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      const workspaceId = sessionStorage.getItem('selectedBoardId');
      const tokenData = await base44.entities.ApiToken.filter({ board_id: workspaceId });
      setTokens(tokenData);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName || newTokenPerms.length === 0) return;

    try {
      const workspaceId = sessionStorage.getItem('selectedBoardId');
      const user = await base44.auth.me();
      
      // Generate a random token
      const tokenValue = 'fbrm_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      await base44.entities.ApiToken.create({
        board_id: workspaceId,
        name: newTokenName,
        token_hash: tokenValue, // In production, this should be hashed
        token_prefix: tokenValue.slice(0, 12),
        permissions: newTokenPerms,
        rate_limit: 1000,
        is_active: true,
        created_by: user.email
      });

      setCreatedToken(tokenValue);
      setNewTokenName('');
      setNewTokenPerms([]);
      loadTokens();
    } catch (error) {
      console.error('Failed to create token:', error);
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!confirm('Revoke this API token? This cannot be undone.')) return;

    try {
      await base44.entities.ApiToken.delete(tokenId);
      loadTokens();
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePermission = (perm) => {
    if (newTokenPerms.includes(perm)) {
      setNewTokenPerms(newTokenPerms.filter(p => p !== perm));
    } else {
      setNewTokenPerms([...newTokenPerms, perm]);
    }
  };

  const allPermissions = [
    { value: 'feedback:read', label: 'Read Feedback' },
    { value: 'feedback:write', label: 'Write Feedback' },
    { value: 'roadmap:read', label: 'Read Roadmap' },
    { value: 'roadmap:write', label: 'Write Roadmap' },
    { value: 'support:read', label: 'Read Support' },
    { value: 'support:write', label: 'Write Support' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading API documentation..." />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">API Documentation</h1>
        <p className="text-slate-500 mt-1">
          Integrate with your board using the REST API
        </p>
      </div>

      <Tabs defaultValue="docs" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Documentation
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Tokens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="space-y-6">
          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                All API requests require authentication using a Bearer token in the Authorization header.
              </p>
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <code className="text-sm text-slate-100">
                  Authorization: Bearer YOUR_API_TOKEN
                </code>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Rate limit: 1,000 requests per hour per token</span>
              </div>
            </CardContent>
          </Card>

          {/* Base URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <code className="text-sm text-slate-100">
                  https://api.yourplatform.com/v1/boards/{workspace?.id}
                </code>
              </div>
            </CardContent>
          </Card>

          {/* Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {API_ENDPOINTS.map((endpoint, index) => (
                <Collapsible 
                  key={index}
                  open={expandedEndpoint === index}
                  onOpenChange={() => setExpandedEndpoint(expandedEndpoint === index ? null : index)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={endpoint.method === 'GET' ? 'primary' : 'success'}
                          className="font-mono text-xs"
                        >
                          {endpoint.method}
                        </Badge>
                        <code className="text-sm font-medium text-slate-700">{endpoint.path}</code>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{endpoint.description}</span>
                        {expandedEndpoint === index 
                          ? <ChevronDown className="h-4 w-4 text-slate-400" />
                          : <ChevronRight className="h-4 w-4 text-slate-400" />
                        }
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 px-4">
                    <div className="space-y-4 pb-4">
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Required Permissions</h4>
                        <div className="flex gap-2">
                          {endpoint.permissions.map(p => (
                            <Badge key={p} variant="outline" className="font-mono text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {endpoint.params && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-2">Query Parameters</h4>
                          <div className="space-y-2">
                            {endpoint.params.map(param => (
                              <div key={param.name} className="flex gap-4 text-sm">
                                <code className="text-blue-600">{param.name}</code>
                                <span className="text-slate-400">{param.type}</span>
                                <span className="text-slate-600">{param.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {endpoint.body && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-2">Request Body</h4>
                          <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm text-slate-100">
                            {endpoint.body}
                          </pre>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Response</h4>
                        <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm text-slate-100">
                          {endpoint.response}
                        </pre>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Tokens</CardTitle>
                <CardDescription>Manage API tokens for this board</CardDescription>
              </div>
              <Button onClick={() => setShowCreateToken(true)} className="bg-slate-900 hover:bg-slate-800">
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No API tokens created yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-12"></TableHead>
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
                          <div className="flex gap-1 flex-wrap">
                            {token.permissions?.slice(0, 2).map(p => (
                              <Badge key={p} variant="outline" size="sm">{p}</Badge>
                            ))}
                            {token.permissions?.length > 2 && (
                              <Badge variant="outline" size="sm">+{token.permissions.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {format(new Date(token.created_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRevokeToken(token.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        </TabsContent>
      </Tabs>

      {/* Create Token Modal */}
      <Dialog open={showCreateToken} onOpenChange={setShowCreateToken}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Token</DialogTitle>
          </DialogHeader>
          
          {createdToken ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-700 mb-2">
                  Token created successfully! Copy it now - you won't be able to see it again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-white p-2 rounded border border-emerald-200 truncate">
                    {createdToken}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(createdToken)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowCreateToken(false); setCreatedToken(null); }}>
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
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g., CI/CD Pipeline"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="mt-2 space-y-2">
                    {allPermissions.map((perm) => (
                      <div key={perm.value} className="flex items-center gap-2">
                        <Checkbox 
                          id={perm.value}
                          checked={newTokenPerms.includes(perm.value)}
                          onCheckedChange={() => togglePermission(perm.value)}
                        />
                        <label htmlFor={perm.value} className="text-sm cursor-pointer">
                          {perm.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreateToken(false)}>Cancel</Button>
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
    </div>
  );
}
