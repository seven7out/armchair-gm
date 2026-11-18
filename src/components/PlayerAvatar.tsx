'use client';

import React, { useState } from 'react';

interface PlayerAvatarProps {
  name: string;
  headshotUrl?: string | null;
  teamId?: string | null;
  teamLogoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

function getEspnTeamLogoUrl(teamId?: string | null): string | undefined {
  if (!teamId) return undefined;
  const clean = teamId.trim().split(' ')[0]?.toUpperCase();
  if (!clean || clean.length < 2 || clean.length > 3) return undefined;
  const slug = clean === 'WAS' ? 'wsh' : clean.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png`;
}

export function PlayerAvatar({
  name,
  headshotUrl,
  teamId,
  teamLogoUrl,
  size = 'md',
}: PlayerAvatarProps) {
  const [failedHeadshotUrl, setFailedHeadshotUrl] = useState<string | null>(
    null
  );
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  const hasHeadshotError = Boolean(
    headshotUrl && failedHeadshotUrl === headshotUrl
  );
  const resolvedTeamLogo = teamLogoUrl || getEspnTeamLogoUrl(teamId);
  const hasLogoError = Boolean(
    resolvedTeamLogo && failedLogoUrl === resolvedTeamLogo
  );

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

  const badgeSizeClasses =
    size === 'lg'
      ? 'h-4.5 w-4.5 -bottom-0.5 -right-0.5'
      : 'h-3.5 w-3.5 -bottom-0.5 -right-0.5';

  const showPhoto = Boolean(headshotUrl && !hasHeadshotError);
  const showLogoFallback = Boolean(!showPhoto && resolvedTeamLogo && !hasLogoError);
  const showCornerTeamBadge = Boolean(showPhoto && resolvedTeamLogo && !hasLogoError);

  return (
    <div className={`${sizeClasses} relative inline-flex shrink-0`}>
      <div className="h-full w-full overflow-hidden rounded-full border border-[#c7bfb0] bg-[#ede8dd] flex items-center justify-center font-mono-ledger font-medium text-[#57534e]">
        {showPhoto && headshotUrl ? (
          <img
            src={headshotUrl}
            alt={name}
            decoding="async"
            onError={() => setFailedHeadshotUrl(headshotUrl)}
            className="h-full w-full object-cover object-top"
          />
        ) : showLogoFallback && resolvedTeamLogo ? (
          <img
            src={resolvedTeamLogo}
            alt={name}
            decoding="async"
            onError={() => setFailedLogoUrl(resolvedTeamLogo)}
            className="h-3/4 w-3/4 object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center leading-none">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-[#8a8379] mb-0.5"
              fill="currentColor"
            >
              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
            </svg>
            <span className="text-[8px] font-bold">{initials}</span>
          </div>
        )}
      </div>
      {showCornerTeamBadge && resolvedTeamLogo && (
        <img
          src={resolvedTeamLogo}
          alt=""
          decoding="async"
          onError={() => setFailedLogoUrl(resolvedTeamLogo)}
          className={`${badgeSizeClasses} absolute rounded-full border border-[#c7bfb0] bg-white object-contain p-[1px] shadow-2xs`}
        />
      )}
    </div>
  );
}
