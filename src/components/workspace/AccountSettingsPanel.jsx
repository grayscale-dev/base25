import { useEffect, useMemo, useState } from "react";
import { Check, LogOut, Save, Trash2, Upload, User } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase-client";
import { createPageUrl } from "@/utils";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import PageLoadingState from "@/components/common/PageLoadingState";
import { StatePanel } from "@/components/common/StateDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function resolveNameParts(user) {
  const first = (user?.first_name || "").trim();
  const last = (user?.last_name || "").trim();
  if (first || last) {
    return { firstName: first, lastName: last };
  }

  const fullName = (user?.full_name || "").trim();
  if (!fullName) {
    return { firstName: "", lastName: "" };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] || "", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(""),
  };
}

function buildFullName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function resolveAuthProviders(authUser) {
  const providers = new Set();
  const identities = Array.isArray(authUser?.identities) ? authUser.identities : [];

  identities.forEach((identity) => {
    if (identity?.provider) {
      providers.add(identity.provider);
    }
  });

  const listedProviders = Array.isArray(authUser?.app_metadata?.providers)
    ? authUser.app_metadata.providers
    : [];
  listedProviders.forEach((provider) => {
    if (provider) {
      providers.add(provider);
    }
  });

  if (authUser?.app_metadata?.provider) {
    providers.add(authUser.app_metadata.provider);
  }

  return providers;
}

export default function AccountSettingsPanel({ onStatusChange }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [user, setUser] = useState(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasEmailPasswordProvider, setHasEmailPasswordProvider] = useState(true);

  const canSaveProfile = useMemo(
    () => Boolean(firstName.trim() && lastName.trim()) && !savingProfile,
    [firstName, lastName, savingProfile]
  );

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const pushStatus = (tone, message) => {
    if (!message) return;
    onStatusChange?.({ tone, message });
  };

  const loadCurrentUser = async () => {
    try {
      setLoadError("");
      setLoading(true);
      const currentUser = await base44.auth.me();
      const names = resolveNameParts(currentUser);

      setUser(currentUser);
      setFirstName(names.firstName);
      setLastName(names.lastName);
      setEmail(currentUser?.email || "");
      setProfilePhotoUrl(currentUser?.profile_photo_url || "");

      const { data: authData } = await supabase.auth.getUser();
      const providers = resolveAuthProviders(authData?.user);
      setHasEmailPasswordProvider(providers.has("email") || providers.size === 0);
    } catch (error) {
      console.error("Failed to load account settings:", error);
      setLoadError("Unable to load your account settings right now.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setProfilePhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      pushStatus("danger", "First name and last name are required.");
      return;
    }

    setSavingProfile(true);
    try {
      let nextProfilePhotoUrl = profilePhotoUrl || null;
      if (profilePhotoFile) {
        const { file_url: uploadedUrl } = await base44.integrations.Core.UploadFile({
          file: profilePhotoFile,
        });
        nextProfilePhotoUrl = uploadedUrl;
      }

      const updatedUser = await base44.auth.updateMe({
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        full_name: buildFullName(trimmedFirstName, trimmedLastName),
        profile_photo_url: nextProfilePhotoUrl,
      });

      setUser(updatedUser);
      setProfilePhotoUrl(nextProfilePhotoUrl || "");
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      setProfilePhotoFile(null);
      setPhotoPreviewUrl("");
      pushStatus("success", "My Account updated.");
    } catch (error) {
      console.error("Failed to save account settings:", error);
      pushStatus("danger", "Unable to update your account. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      pushStatus("danger", "Enter and confirm your new password.");
      return;
    }
    if (newPassword.length < 8) {
      pushStatus("danger", "Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      pushStatus("danger", "Passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw error;
      }
      setNewPassword("");
      setConfirmPassword("");
      pushStatus("success", "Password updated.");
    } catch (error) {
      console.error("Failed to update password:", error);
      pushStatus("danger", "Unable to update password. You may need to sign in again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      sessionStorage.clear();
      await base44.auth.logout(window.location.origin + createPageUrl("Home"));
    } catch (error) {
      console.error("Failed to sign out:", error);
      pushStatus("danger", "Unable to sign out right now.");
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await base44.functions.invoke("deleteMyAccount", {});
      sessionStorage.clear();
      window.location.href = createPageUrl("Home");
    } catch (error) {
      console.error("Failed to delete account:", error);
      pushStatus("danger", "Unable to delete your account right now.");
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return <PageLoadingState text="Loading account settings..." />;
  }

  if (loadError) {
    return (
      <StatePanel
        tone="danger"
        title="Account settings unavailable"
        description={loadError}
        action={() => {
          void loadCurrentUser();
        }}
        actionLabel="Retry"
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Account</CardTitle>
          <CardDescription>Manage your identity and profile details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} readOnly className="mt-1.5 max-w-md bg-slate-50" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>
                First Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-1.5"
                placeholder="First name"
              />
            </div>
            <div>
              <Label>
                Last Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-1.5"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <Label>Profile Photo</Label>
            <div className="mt-2 flex items-center gap-4">
              {photoPreviewUrl || profilePhotoUrl ? (
                <img
                  src={photoPreviewUrl || profilePhotoUrl}
                  alt={buildFullName(firstName, lastName) || user?.email || "Profile"}
                  className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
                  <User className="h-7 w-7 text-slate-400" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      {profilePhotoFile ? "Change Photo" : "Upload Photo"}
                    </span>
                  </Button>
                </label>
                {(photoPreviewUrl || profilePhotoUrl) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (photoPreviewUrl) {
                        URL.revokeObjectURL(photoPreviewUrl);
                      }
                      setPhotoPreviewUrl("");
                      setProfilePhotoFile(null);
                      setProfilePhotoUrl("");
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={!canSaveProfile}>
              <Save className="mr-2 h-4 w-4" />
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasEmailPasswordProvider ? (
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change your account password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1.5 max-w-md"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1.5 max-w-md"
                placeholder="Re-enter password"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpdatePassword} disabled={savingPassword}>
                <Check className="mr-2 h-4 w-4" />
                {savingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="text-rose-700">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your account and remove your workspace memberships.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button
            variant="destructive"
            className="bg-rose-600 hover:bg-rose-700"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deletingAccount}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSignOut} disabled={signingOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {signingOut ? "Signing Out..." : "Sign Out"}
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Account"
        description="Are you sure you want to delete your account? This action cannot be undone."
        confirmLabel={deletingAccount ? "Deleting..." : "Delete Account"}
        onConfirm={() => {
          void handleDeleteAccount();
        }}
        loading={deletingAccount}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
      />
    </div>
  );
}
