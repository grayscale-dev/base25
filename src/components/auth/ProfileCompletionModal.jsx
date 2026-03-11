import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Upload, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Profile Completion Modal
 *
 * Shown when a user needs to complete required profile fields.
 * Blocks the action until profile is completed, then retries.
 */
export default function ProfileCompletionModal({
  isOpen,
  onComplete,
  onCancel,
  allowCancel = true,
  initialFirstName = '',
  initialLastName = '',
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setFirstName(initialFirstName);
    setLastName(initialLastName);
    setError(null);
  }, [isOpen, initialFirstName, initialLastName]);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const updates = {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        full_name: `${trimmedFirstName} ${trimmedLastName}`.trim(),
      };

      // Upload profile photo if provided (optional)
      if (profilePhoto) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: profilePhoto });
          updates.profile_photo_url = file_url;
        } catch (photoError) {
          console.error('Failed to upload photo (optional):', photoError);
          // Continue without photo - it's optional
        }
      }

      // Update user profile
      await base44.auth.updateMe(updates);

      // Clean up preview URL
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }

      onComplete();
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && allowCancel && !saving) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        closable={allowCancel && !saving}
        dismissableMask={allowCancel && !saving}
      >
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            First name and last name are required. Your profile photo is optional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName" className="flex items-center gap-2 mb-2">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full"
                autoFocus
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="flex items-center gap-2 mb-2">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full"
                disabled={saving}
              />
            </div>
          </div>

          {/* Profile Photo - Optional */}
          <div>
            <Label htmlFor="profilePhoto" className="flex items-center gap-2 mb-2">
              Profile Photo <span className="text-xs text-slate-500">(Optional)</span>
            </Label>
            
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <div className="relative">
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    className="h-16 w-16 rounded-full object-cover border-2 border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(photoPreview);
                      setPhotoPreview(null);
                      setProfilePhoto(null);
                    }}
                    disabled={saving}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="h-8 w-8 text-slate-400" />
                </div>
              )}

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  disabled={saving}
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  <Upload className="h-4 w-4 text-slate-600" />
                  <span className="text-sm text-slate-600">
                    {profilePhoto ? 'Change Photo' : 'Upload Photo'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {allowCancel ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            ) : null}
            <Button 
              type="submit" 
              disabled={!firstName.trim() || !lastName.trim() || saving}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save and Continue'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
