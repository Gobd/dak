import { useEffect, useState } from 'react';
import { Plus, Trash2, Calculator, Edit2, X, Check } from 'lucide-react';
import { Card, Button, Input, Modal, ConfirmModal, SegmentedControl } from '@dak/ui';
import { useTargetsStore } from '../stores/targets-store';
import { usePresetsStore } from '../stores/presets-store';
import { useAuthStore } from '../stores/auth-store';
import { usePreferencesStore } from '../stores/preferences-store';
import { calculateUnits, formatUnits, formatVolumeUnit, ozToMl, mlToOz } from '../lib/units';
import type { Preset } from '../types';

export function Settings() {
  const { target, fetchTarget, setTarget } = useTargetsStore();
  const { presets, fetchPresets, addPreset, updatePreset, deletePreset } = usePresetsStore();
  const { user } = useAuthStore();
  const { volumeUnit, setVolumeUnit } = usePreferencesStore();

  // Target state
  const [targetInput, setTargetInput] = useState('');
  const [showTargetCalculator, setShowTargetCalculator] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [calcCount, setCalcCount] = useState('');
  const [calcVolume, setCalcVolume] = useState('');
  const [calcVolumeUnit, setCalcVolumeUnit] = useState<'ml' | 'oz'>(volumeUnit);
  const [calcPercentage, setCalcPercentage] = useState('');

  // Preset state
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetVolume, setPresetVolume] = useState('');
  const [presetVolumeUnit, setPresetVolumeUnit] = useState<'ml' | 'oz'>('ml');
  const [presetPercentage, setPresetPercentage] = useState('');
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);

  useEffect(() => {
    fetchTarget();
    fetchPresets();
  }, [fetchTarget, fetchPresets]);

  useEffect(() => {
    if (target) {
      setTargetInput(target.daily_limit.toString());
    }
  }, [target]);

  // Target calculator
  const calculatedTarget =
    calcCount && calcVolume && calcPercentage
      ? calculateUnits(
          parseFloat(calcCount) *
            (calcVolumeUnit === 'oz' ? ozToMl(parseFloat(calcVolume)) : parseFloat(calcVolume)),
          parseFloat(calcPercentage),
        )
      : null;

  const handleSaveTarget = async () => {
    const value = parseFloat(targetInput);
    if (!isNaN(value) && value > 0) {
      await setTarget(value);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    }
  };

  const handleUseCalculatedTarget = async () => {
    if (calculatedTarget && calcCount && calcVolume && calcPercentage) {
      const value = parseFloat(calculatedTarget.toFixed(1));
      const volumeMl =
        calcVolumeUnit === 'oz' ? ozToMl(parseFloat(calcVolume)) : parseFloat(calcVolume);

      setTargetInput(value.toString());
      await setTarget(value, {
        count: parseFloat(calcCount),
        volumeMl,
        percentage: parseFloat(calcPercentage),
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
      setShowTargetCalculator(false);
      setCalcCount('');
      setCalcVolume('');
      setCalcPercentage('');
    }
  };

  // Preset handlers
  const handleOpenPresetModal = (preset?: Preset) => {
    if (preset) {
      setEditingPreset(preset);
      setPresetName(preset.name);
      // Show in user's preferred unit
      if (volumeUnit === 'oz') {
        setPresetVolume(mlToOz(preset.volume_ml).toString());
        setPresetVolumeUnit('oz');
      } else {
        setPresetVolume(preset.volume_ml.toString());
        setPresetVolumeUnit('ml');
      }
      setPresetPercentage(preset.percentage.toString());
    } else {
      setEditingPreset(null);
      setPresetName('');
      setPresetVolume('');
      setPresetVolumeUnit(volumeUnit); // Default to user's preferred unit
      setPresetPercentage('');
    }
    setShowPresetModal(true);
  };

  const handleSavePreset = async () => {
    const volume = parseFloat(presetVolume);
    const percentage = parseFloat(presetPercentage);

    if (!presetName || isNaN(volume) || isNaN(percentage)) {
      return;
    }

    const volumeMl = presetVolumeUnit === 'oz' ? ozToMl(volume) : volume;

    if (editingPreset) {
      await updatePreset(editingPreset.id, presetName, volumeMl, percentage);
    } else {
      await addPreset(presetName, volumeMl, percentage);
    }

    setShowPresetModal(false);
  };

  const handleDeletePreset = async () => {
    if (!deletePresetId) return;
    await deletePreset(deletePresetId);
    setDeletePresetId(null);
  };

  const presetPreviewUnits =
    presetVolume && presetPercentage
      ? calculateUnits(
          presetVolumeUnit === 'oz' ? ozToMl(parseFloat(presetVolume)) : parseFloat(presetVolume),
          parseFloat(presetPercentage),
        )
      : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Daily Target */}
      <Card>
        <h2 className="font-semibold mb-4">Daily Target</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Units per day</label>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="flex-1"
              />
              <Button variant="primary" onClick={handleSaveTarget}>
                {savedFeedback ? 'Saved!' : 'Save'}
              </Button>
            </div>
            <p className="text-sm text-text-muted mt-1">1 unit = 10ml ethanol</p>
            {target?.calc_count && target?.calc_volume_ml && target?.calc_percentage && (
              <p className="text-sm text-text-muted mt-1">
                Based on: {target.calc_count} ×{' '}
                {formatVolumeUnit(target.calc_volume_ml, volumeUnit)} @ {target.calc_percentage}%
              </p>
            )}
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              if (!showTargetCalculator) {
                setCalcVolumeUnit(volumeUnit);
              }
              setShowTargetCalculator(!showTargetCalculator);
            }}
          >
            <Calculator size={18} className="mr-2" />
            {showTargetCalculator ? 'Hide' : 'Show'} Target Calculator
          </Button>

          {showTargetCalculator && (
            <div className="p-4 bg-surface-raised rounded-lg space-y-3">
              <p className="text-sm text-text-muted">
                Calculate from servings: count × volume × strength
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">Number of servings</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 3"
                  value={calcCount}
                  onChange={(e) => setCalcCount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Volume per serving</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 355"
                    value={calcVolume}
                    onChange={(e) => setCalcVolume(e.target.value)}
                    className="flex-1"
                  />
                  <div className="shrink-0">
                    <SegmentedControl
                      options={[
                        { value: 'ml', label: 'ml' },
                        { value: 'oz', label: 'oz' },
                      ]}
                      value={calcVolumeUnit}
                      onChange={setCalcVolumeUnit}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Strength %</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 5.0"
                  value={calcPercentage}
                  onChange={(e) => setCalcPercentage(e.target.value)}
                />
              </div>

              {calculatedTarget !== null && !isNaN(calculatedTarget) && (
                <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
                  <div>
                    <span className="text-2xl font-bold">{formatUnits(calculatedTarget)}</span>
                    <span className="text-text-muted ml-1">units/day</span>
                  </div>
                  <Button variant="primary" onClick={handleUseCalculatedTarget}>
                    <Check size={18} className="mr-1" />
                    Use This
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Preferences */}
      <Card>
        <h2 className="font-semibold mb-4">Preferences</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Volume unit</div>
            <div className="text-sm text-text-muted">Display volumes in oz or ml</div>
          </div>
          <SegmentedControl
            options={[
              { value: 'ml', label: 'ml' },
              { value: 'oz', label: 'oz' },
            ]}
            value={volumeUnit}
            onChange={setVolumeUnit}
          />
        </div>
      </Card>

      {/* Presets */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Quick Add Presets</h2>
          <Button variant="secondary" size="sm" onClick={() => handleOpenPresetModal()}>
            <Plus size={16} className="mr-1" />
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between gap-2 p-3 bg-surface-raised rounded-lg"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{preset.name}</div>
                <div className="text-sm text-text-muted">
                  {preset.volume_ml}ml ({mlToOz(preset.volume_ml)}oz) @ {preset.percentage}% ={' '}
                  {formatUnits(calculateUnits(preset.volume_ml, preset.percentage))} units
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenPresetModal(preset)}
                  title="Edit"
                >
                  <Edit2 size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeletePresetId(preset.id)}
                  title="Delete"
                >
                  <Trash2 size={16} className="text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Account */}
      <Card>
        <h2 className="font-semibold mb-4">Account</h2>
        <p className="text-text-muted">{user?.email}</p>
      </Card>

      {/* Preset Modal */}
      <Modal open={showPresetModal} onClose={() => setShowPresetModal(false)} wide>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingPreset ? 'Edit Preset' : 'Add Preset'}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowPresetModal(false)}>
              <X size={20} />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                type="text"
                placeholder="e.g. Pint"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Volume</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={presetVolume}
                  onChange={(e) => setPresetVolume(e.target.value)}
                  className="flex-1"
                />
                <div className="shrink-0">
                  <SegmentedControl
                    options={[
                      { value: 'ml', label: 'ml' },
                      { value: 'oz', label: 'oz' },
                    ]}
                    value={presetVolumeUnit}
                    onChange={setPresetVolumeUnit}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Strength %</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 5.0"
                value={presetPercentage}
                onChange={(e) => setPresetPercentage(e.target.value)}
              />
            </div>

            {presetPreviewUnits !== null && !isNaN(presetPreviewUnits) && (
              <div className="text-center py-2 bg-surface-raised rounded-lg">
                <span className="text-2xl font-bold">{formatUnits(presetPreviewUnits)}</span>
                <span className="text-text-muted ml-1">units</span>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={handleSavePreset}
              disabled={!presetName || !presetVolume || !presetPercentage}
            >
              {editingPreset ? 'Update' : 'Add'} Preset
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Preset Confirmation */}
      <ConfirmModal
        open={deletePresetId !== null}
        onClose={() => setDeletePresetId(null)}
        onConfirm={handleDeletePreset}
        title="Delete Preset"
        message="Are you sure you want to delete this preset?"
        confirmText="Delete"
      />
    </div>
  );
}
