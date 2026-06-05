"use client";

import React from "react";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full w-full px-4 sm:px-8 py-6 space-y-6 animate-pulse">
      {/* Intestazione Skeleton */}
      <div className="space-y-2.5">
        <div 
          className="h-4 w-32 rounded-lg" 
          style={{ background: "hsl(220 20% 20%)" }}
        />
        <div 
          className="h-8 w-64 rounded-xl" 
          style={{ background: "hsl(220 20% 20%)" }}
        />
      </div>

      <div 
        className="h-[1px] w-full" 
        style={{ background: "hsl(220 20% 14%)" }}
      />

      {/* Griglia delle Card Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5 border flex flex-col justify-between h-40 space-y-4"
            style={{
              background: "hsl(220 26% 14% / 0.4)",
              borderColor: "hsl(220 20% 16%)",
            }}
          >
            <div className="space-y-3">
              <div 
                className="h-5 w-2/3 rounded-lg" 
                style={{ background: "hsl(220 20% 20%)" }}
              />
              <div 
                className="h-3 w-1/3 rounded-md" 
                style={{ background: "hsl(220 20% 18%)" }}
              />
            </div>

            <div className="flex gap-2">
              <div 
                className="h-8 w-16 rounded-lg" 
                style={{ background: "hsl(220 20% 18%)" }}
              />
              <div 
                className="h-8 w-16 rounded-lg" 
                style={{ background: "hsl(220 20% 18%)" }}
              />
              <div 
                className="h-8 w-16 rounded-lg" 
                style={{ background: "hsl(220 20% 18%)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
