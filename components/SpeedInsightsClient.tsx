"use client";

import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function SpeedInsightsClient() {
  // Render the client-only SpeedInsights component inside a small wrapper
  return <SpeedInsights />;
}
