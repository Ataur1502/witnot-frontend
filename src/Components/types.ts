// src/types.ts

export type QuizStatus = 'unanswered' | 'answered' | 'skipped' | 'penalized';

export interface Option {
    key: string; // 'A', 'B', 'C', 'D'
    text: string;
}

export interface Question {
    id: number;
    questionText: string;
    options: Option[];
    imageUrl: string | null;
    marks: number;
    userAnswer: string | null; // e.g., 'A', 'B', or "PENALIZED"
    isPenalized: boolean; // Tracks if mark deduction has occurred for this question
}