import { useState, useEffect } from 'react';
import { Modal, Input, Button, DatePickerCompact } from '@dak/ui';
import type { MaintenanceTask } from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    interval_value: number;
    interval_unit: 'days' | 'weeks' | 'months';
    notes?: string;
    last_done?: string;
  }) => void;
  task?: MaintenanceTask | null;
}

export function TaskModal({ isOpen, onClose, onSave, task }: TaskModalProps) {
  const [name, setName] = useState('');
  const [intervalValue, setIntervalValue] = useState(30);
  const [intervalUnit, setIntervalUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [notes, setNotes] = useState('');
  const [lastDone, setLastDone] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setName(task.name);
        setIntervalValue(task.interval_value);
        setIntervalUnit(task.interval_unit);
        setNotes(task.notes || '');
        setLastDone(task.last_done ? new Date(task.last_done + 'T00:00:00') : null);
      } else {
        setName('');
        setIntervalValue(30);
        setIntervalUnit('days');
        setNotes('');
        setLastDone(null);
      }
      setShowDatePicker(false);
    }
  }, [isOpen, task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      interval_value: intervalValue,
      interval_unit: intervalUnit,
      notes: notes.trim() || undefined,
      last_done: lastDone
        ? `${lastDone.getFullYear()}-${String(lastDone.getMonth() + 1).padStart(2, '0')}-${String(lastDone.getDate()).padStart(2, '0')}`
        : undefined,
    });
    onClose();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={task ? 'Edit Task' : 'Add Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Change furnace filter"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-secondary mb-1">Every</label>
            <Input
              type="number"
              min={1}
              value={intervalValue}
              onChange={(e) => setIntervalValue(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-secondary mb-1">Unit</label>
            <select
              value={intervalUnit}
              onChange={(e) => setIntervalUnit(e.target.value as 'days' | 'weeks' | 'months')}
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Last Done {!task && '(optional)'}
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="w-full px-3 py-2 bg-surface-raised border border-border rounded-lg text-left text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {lastDone ? formatDate(lastDone) : 'Not set (starts from today)'}
            </button>
            {showDatePicker && (
              <div className="absolute z-10 mt-1 bg-surface-raised border border-border rounded-lg shadow-lg p-2">
                <DatePickerCompact
                  value={lastDone || new Date()}
                  onChange={(date) => {
                    setLastDone(date);
                    setShowDatePicker(false);
                  }}
                  allowFuture={false}
                />
                {lastDone && (
                  <button
                    type="button"
                    onClick={() => {
                      setLastDone(null);
                      setShowDatePicker(false);
                    }}
                    className="w-full mt-2 px-3 py-1 text-sm text-text-muted hover:text-text transition-colors"
                  >
                    Clear date
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Notes (optional)
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional details..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            {task ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
