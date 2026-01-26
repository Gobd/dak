import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Avatar, Modal, ConfirmModal, Input, Button } from '@dak/ui';
import { useMembersStore } from '../../stores/members-store';
import { usePointsStore } from '../../stores/points-store';

interface RedeemModalProps {
  onClose: () => void;
}

export function RedeemModal({ onClose }: RedeemModalProps) {
  const { members } = useMembersStore();
  const { balances, redeemPoints } = usePointsStore();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const balance = selectedMemberId ? (balances[selectedMemberId] ?? 0) : 0;

  const handleRedeem = async () => {
    if (!selectedMemberId || amount <= 0 || !notes.trim()) return;

    setLoading(true);
    setError('');

    const result = await redeemPoints(selectedMemberId, amount, notes.trim());

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setError(result.error ?? 'Failed to redeem points');
    }

    setLoading(false);
  };

  const quickAmounts = [5, 10, 25, 50];

  if (success) {
    return (
      <Modal open={true} onClose={onClose} fit>
        <div className="text-center p-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-text mb-2">Points Redeemed!</h2>
          <p className="text-text-muted">
            {amount} points for {notes}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={true} onClose={onClose} title="Redeem Points">
      <div className="space-y-6">
        {/* Member selector */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Family Member
          </label>
          <div className="flex gap-3 flex-wrap">
            {members.map((member) => {
              const memberBalance = balances[member.id] ?? 0;
              return (
                <Button
                  key={member.id}
                  variant="secondary"
                  onClick={() => {
                    setSelectedMemberId(member.id);
                    setAmount(0);
                  }}
                  className={`flex flex-col items-center p-3 h-auto ${
                    selectedMemberId === member.id ? 'ring-2 ring-accent bg-accent-light' : ''
                  }`}
                >
                  <Avatar
                    name={member.name}
                    emoji={member.avatar_emoji}
                    color={member.color}
                    size="lg"
                  />
                  <span className="text-sm font-medium mt-1">{member.name}</span>
                  <span className="text-xs text-text-muted">{memberBalance} pts</span>
                </Button>
              );
            })}
          </div>
        </div>

        {selectedMember && (
          <>
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Points to Redeem
              </label>
              <div className="flex items-center justify-center gap-4 mb-3">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setAmount(Math.max(0, amount - 5))}
                  className="w-12 h-12"
                >
                  <Minus size={24} />
                </Button>
                <div className="text-center">
                  <span className="text-4xl font-bold text-text">{amount}</span>
                  <p className="text-sm text-text-muted">of {balance} available</p>
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setAmount(Math.min(balance, amount + 5))}
                  className="w-12 h-12"
                >
                  <Plus size={24} />
                </Button>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2 justify-center">
                {quickAmounts.map((qa) => (
                  <Button
                    key={qa}
                    variant={amount === qa ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setAmount(Math.min(balance, qa))}
                    disabled={qa > balance}
                  >
                    {qa}
                  </Button>
                ))}
                <Button
                  variant={amount === balance ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setAmount(balance)}
                >
                  All
                </Button>
              </div>
            </div>

            {/* Notes */}
            <Input
              label="What for?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., 30 min screen time, ice cream, etc."
            />

            {error && <p className="text-danger text-sm text-center">{error}</p>}

            {/* Submit */}
            <Button
              variant="primary"
              onClick={() => setShowConfirm(true)}
              disabled={amount <= 0 || !notes.trim() || loading}
              className="w-full bg-success hover:bg-success-hover"
            >
              {loading ? 'Processing...' : `Redeem ${amount} Points`}
            </Button>
          </>
        )}
      </div>

      {/* Confirmation modal */}
      <ConfirmModal
        open={showConfirm && !!selectedMember}
        message={`Redeem ${amount} points from ${selectedMember?.name ?? ''} for "${notes}"? They will have ${balance - amount} points remaining.`}
        confirmText="Redeem"
        variant="primary"
        onConfirm={() => {
          setShowConfirm(false);
          handleRedeem();
        }}
        onClose={() => setShowConfirm(false)}
      />
    </Modal>
  );
}
