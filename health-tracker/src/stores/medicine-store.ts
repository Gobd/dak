import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { broadcastSync } from '../lib/realtime';
import type { MedicineCourse, MedicineDose } from '../types';
import { addDays, format } from 'date-fns';

interface MedicineState {
  courses: MedicineCourse[];
  doses: Record<string, MedicineDose[]>;
  loading: boolean;
  fetchCourses: () => Promise<void>;
  fetchDoses: (courseId: string) => Promise<void>;
  addCourse: (data: {
    person_id: string;
    name: string;
    start_date: string;
    duration_days: number;
    doses_per_day: number;
    notes?: string;
  }) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  toggleDose: (doseId: string, taken: boolean) => Promise<boolean>;
}

export const useMedicineStore = create<MedicineState>((set, get) => ({
  courses: [],
  doses: {},
  loading: false,

  fetchCourses: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('medicine_courses')
      .select('*, person:people(*)')
      .order('start_date', { ascending: false });

    if (!error && data) {
      set({ courses: data });
    }
    set({ loading: false });
  },

  fetchDoses: async (courseId: string) => {
    const { data, error } = await supabase
      .from('medicine_doses')
      .select('*')
      .eq('course_id', courseId)
      .order('scheduled_date')
      .order('dose_number');

    if (!error && data) {
      set((state) => ({
        doses: { ...state.doses, [courseId]: data },
      }));
    }
  },

  addCourse: async (data) => {
    // Create the course
    const { data: course, error } = await supabase
      .from('medicine_courses')
      .insert(data)
      .select()
      .single();

    if (error || !course) return;

    // Generate all doses
    const doses: Array<{
      course_id: string;
      scheduled_date: string;
      dose_number: number;
    }> = [];

    const startDate = new Date(data.start_date + 'T00:00:00');
    for (let day = 0; day < data.duration_days; day++) {
      const date = addDays(startDate, day);
      for (let doseNum = 1; doseNum <= data.doses_per_day; doseNum++) {
        doses.push({
          course_id: course.id,
          scheduled_date: format(date, 'yyyy-MM-dd'),
          dose_number: doseNum,
        });
      }
    }

    await supabase.from('medicine_doses').insert(doses);

    get().fetchCourses();
    get().fetchDoses(course.id);
    broadcastSync({ type: 'medicine' });
  },

  deleteCourse: async (id: string) => {
    const { error } = await supabase.from('medicine_courses').delete().eq('id', id);

    if (!error) {
      get().fetchCourses();
      broadcastSync({ type: 'medicine' });
    }
  },

  toggleDose: async (doseId: string, taken: boolean) => {
    const { data, error } = await supabase
      .from('medicine_doses')
      .update({
        taken,
        taken_at: taken ? new Date().toISOString() : null,
      })
      .eq('id', doseId)
      .select('course_id')
      .single();

    if (!error && data) {
      get().fetchDoses(data.course_id);
      broadcastSync({ type: 'medicine' });
      return true;
    }
    return false;
  },
}));
