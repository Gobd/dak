import { useEffect, useState } from 'react';
import { Plus, X, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Card, Button, Input, Modal } from '@dak/ui';
import { useEntriesStore } from '../stores/entries-store';
import { useTargetsStore } from '../stores/targets-store';
import { usePresetsStore } from '../stores/presets-store';
import { ProgressRing } from '../components/ProgressRing';
import { MotivationBanner } from '../components/MotivationBanner';
import { calculateUnits, formatUnits, formatVolume, ozToMl } from '../lib/units';
import { getRingColor } from '../lib/motivation';
import type { Preset } from '../types';

interface PreviewState {
  units: number;
  name: string;
  volumeMl: number;
  percentage: number;
  notes?: string;
}

export function Home() {
  const {
    todayEntries,
    streaks,
    fetchTodayEntries,
    fetchStreaks,
    addEntry,
    deleteEntry,
    getTodayTotal,
  } = useEntriesStore();
  const { target, fetchTarget } = useTargetsStore();
  const { presets, fetchPresets } = usePresetsStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [volumeInput, setVolumeInput] = useState('');
  const [volumeUnit, setVolumeUnit] = useState<'ml' | 'oz'>('oz');
  const [percentageInput, setPercentageInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  // Preview state - shows what adding a drink would do
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    fetchTarget();
    fetchTodayEntries();
    fetchPresets();
  }, [fetchTarget, fetchTodayEntries, fetchPresets]);

  // Fetch streaks when target changes
  useEffect(() => {
    if (target) {
      fetchStreaks(target.daily_limit);
    }
  }, [target, fetchStreaks, todayEntries]);

  const dailyLimit = target?.daily_limit ?? 14;
  const todayTotal = getTodayTotal();

  // Preview a preset before adding
  const handlePresetPreview = (preset: Preset) => {
    const units = calculateUnits(preset.volume_ml, preset.percentage);
    setPreview({
      units,
      name: preset.name,
      volumeMl: preset.volume_ml,
      percentage: preset.percentage,
    });
  };

  // Confirm adding the previewed drink
  const handleConfirmAdd = async () => {
    if (!preview) return;

    await addEntry(preview.volumeMl, preview.percentage, preview.notes);
    setPreview(null);

    if (target) {
      fetchStreaks(target.daily_limit);
    }
  };

  // Cancel preview
  const handleCancelPreview = () => {
    setPreview(null);
  };

  // Preview custom entry from modal
  const handlePreviewCustom = () => {
    const volume = parseFloat(volumeInput);
    const percentage = parseFloat(percentageInput);

    if (isNaN(volume) || isNaN(percentage) || volume <= 0 || percentage <= 0) {
      return;
    }

    const volumeMl = volumeUnit === 'oz' ? ozToMl(volume) : volume;
    const units = calculateUnits(volumeMl, percentage);

    setPreview({
      units,
      name: 'Custom',
      volumeMl,
      percentage,
      notes: notesInput || undefined,
    });

    setShowAddModal(false);
  };

  // Reset custom form
  const resetCustomForm = () => {
    setVolumeInput('');
    setPercentageInput('');
    setNotesInput('');
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    if (target) {
      fetchStreaks(target.daily_limit);
    }
  };

  // Calculate preview values
  const previewUnits =
    volumeInput && percentageInput
      ? calculateUnits(
          volumeUnit === 'oz' ? ozToMl(parseFloat(volumeInput)) : parseFloat(volumeInput),
          parseFloat(percentageInput),
        )
      : null;

  // What the total would be after adding preview
  const projectedTotal = preview ? todayTotal + preview.units : todayTotal;
  const projectedPercentage = dailyLimit > 0 ? (projectedTotal / dailyLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Motivation Banner */}
      <MotivationBanner todayUnits={todayTotal} dailyLimit={dailyLimit} streaks={streaks} />

      {/* Progress Ring */}
      <Card className="flex justify-center py-8">
        <ProgressRing current={todayTotal} target={dailyLimit} />
      </Card>

      {/* Preview Card - shows impact before confirming */}
      {preview && (
        <Card className="border-2 border-accent">
          <div className="flex items-center gap-2 mb-3">
            <Eye size={18} className="text-accent" />
            <h2 className="font-semibold">Preview: {preview.name}</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-text-muted">This serving:</span>
              <span className="font-medium">{formatUnits(preview.units)} units</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-muted">Current total:</span>
              <span className="font-medium">{formatUnits(todayTotal)} units</span>
            </div>

            <div className="border-t border-border pt-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">After adding:</span>
                <span
                  className={`text-lg font-bold ${getRingColor(projectedPercentage).replace('stroke-', 'text-')}`}
                >
                  {formatUnits(projectedTotal)} units
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-text-muted text-sm">Of daily target:</span>
                <span
                  className={`text-sm font-medium ${getRingColor(projectedPercentage).replace('stroke-', 'text-')}`}
                >
                  {Math.round(projectedPercentage)}%{projectedPercentage > 100 && ' (OVER)'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={handleCancelPreview}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleConfirmAdd}>
                Add It
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Add Presets */}
      <Card>
        <h2 className="font-semibold mb-3">Quick Add</h2>
        <p className="text-text-muted text-sm mb-3">Tap to preview impact first</p>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              variant="secondary"
              className="justify-between text-left h-auto py-2 px-3"
              onClick={() => handlePresetPreview(preset)}
            >
              <span className="font-medium">{preset.name}</span>
              <span className="text-text-muted text-sm">
                {formatUnits(calculateUnits(preset.volume_ml, preset.percentage))}u
              </span>
            </Button>
          ))}
          <Button
            variant="secondary"
            className="justify-center"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} className="mr-1" />
            Custom
          </Button>
        </div>
      </Card>

      {/* Today's Log */}
      {todayEntries.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3">Today&apos;s Log</h2>
          <div className="space-y-2">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-surface-raised rounded-lg"
              >
                <div>
                  <div className="font-medium">{formatUnits(entry.units)} units</div>
                  <div className="text-sm text-text-muted">
                    {formatVolume(entry.volume_ml)} @ {entry.percentage}%
                    {entry.notes && ` - ${entry.notes}`}
                  </div>
                  <div className="text-xs text-text-muted">
                    {format(new Date(entry.logged_at), 'h:mm a')}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(entry.id)}
                  title="Delete"
                >
                  <Trash2 size={16} className="text-text-muted hover:text-danger" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Manual Add Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Custom Entry</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
              <X size={20} />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Volume</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={volumeInput}
                  onChange={(e) => setVolumeInput(e.target.value)}
                  className="flex-1"
                />
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      volumeUnit === 'ml'
                        ? 'bg-accent text-white'
                        : 'bg-surface-raised text-text-secondary hover:bg-surface-sunken'
                    }`}
                    onClick={() => setVolumeUnit('ml')}
                  >
                    ml
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      volumeUnit === 'oz'
                        ? 'bg-accent text-white'
                        : 'bg-surface-raised text-text-secondary hover:bg-surface-sunken'
                    }`}
                    onClick={() => setVolumeUnit('oz')}
                  >
                    oz
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Strength %</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 5.0"
                value={percentageInput}
                onChange={(e) => setPercentageInput(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <Input
                type="text"
                placeholder="What was it?"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
              />
            </div>

            {/* Live preview of units and impact */}
            {previewUnits !== null && !isNaN(previewUnits) && (
              <div className="p-3 bg-surface-raised rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">This serving:</span>
                  <span className="font-bold">{formatUnits(previewUnits)} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Would bring you to:</span>
                  <span
                    className={`font-bold ${getRingColor(((todayTotal + previewUnits) / dailyLimit) * 100).replace('stroke-', 'text-')}`}
                  >
                    {formatUnits(todayTotal + previewUnits)} units (
                    {Math.round(((todayTotal + previewUnits) / dailyLimit) * 100)}%)
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowAddModal(false);
                  resetCustomForm();
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  handlePreviewCustom();
                  resetCustomForm();
                }}
                disabled={!volumeInput || !percentageInput}
              >
                <Eye size={16} className="mr-1" />
                Preview
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
