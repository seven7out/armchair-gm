'use client';

import React, { useState } from 'react';

interface PlayerAvatarProps {
  name: string;
  headshotUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function PlayerAvatar({
  name,
  headshotUrl,
  size = 'md',
}: PlayerAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const sizeClasses =
    size === 'sm'
      ? 'h-8 w-8 text-[10px]'
      : size === 'lg'
      ? 'h-14 w-14 text-sm'
      : 'h-10 w-10 text-xs';

  return (
    <div
      className={`${sizeClasses} relative shrink-0 overflow-hidden rounded-full border border-[#c7bfb0] bg-[#ede8dd] flex items-center justify-center font-mono-ledger font-medium text-[#57534e]`}
    >
      {headshotUrl && !hasError ? (
        <img
          src={headshotUrl}
          alt={name}
          loading="lazy"
          onError={() => setHasError(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
