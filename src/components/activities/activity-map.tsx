"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useTranslations } from "next-intl";
import { formatCurrency, formatDate, getTranslatedField } from "@/lib/utils";
import type { ActivityWithInstructor } from "@/lib/queries/activities";
import type { TranslatedField } from "@/lib/types/database";

// Leaflet icon fix — same as location-map-picker.tsx.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SAO_PAULO: [number, number] = [-23.5505, -46.6333];

interface ActivityMapProps {
  activities: ActivityWithInstructor[];
  locale: string;
}

/**
 * Read-only Leaflet map showing activity pins with popups.
 * Auto-fits bounds to all markers when activities are present.
 * Falls back to São Paulo center when there are no activities.
 */
export function ActivityMap({ activities, locale }: ActivityMapProps) {
  const t = useTranslations("activities");

  const bounds = useMemo(() => {
    if (activities.length === 0) return null;
    const latLngs = activities.map(
      (a) => [a.latitude, a.longitude] as [number, number]
    );
    return L.latLngBounds(latLngs).pad(0.1);
  }, [activities]);

  return (
    <div className="h-[60vh] rounded-lg overflow-hidden border border-charcoal-lighter/20">
      <MapContainer
        center={SAO_PAULO}
        zoom={12}
        bounds={bounds || undefined}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {activities.map((activity) => {
          const title = getTranslatedField(
            activity.title as TranslatedField,
            locale
          );
          const instructorName =
            activity.instructor_profiles?.users?.name || "";

          return (
            <Marker
              key={activity.id}
              position={[activity.latitude, activity.longitude]}
            >
              <Popup maxWidth={260} minWidth={200}>
                <div className="text-sm">
                  {activity.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activity.cover_image_url}
                      alt=""
                      className="w-full h-28 object-cover rounded mb-2"
                    />
                  )}
                  <a
                    href={`/${locale}/activities/${activity.id}`}
                    className="font-semibold text-charcoal hover:text-primary-400 block mb-1"
                  >
                    {title}
                  </a>
                  <div className="text-xs text-charcoal-lighter mb-1">
                    {instructorName}
                  </div>
                  <div className="text-xs text-charcoal-lighter mb-1">
                    {formatDate(activity.date, locale)} · {activity.time?.slice(0, 5)}
                  </div>
                  <div className="font-semibold text-primary-400">
                    {formatCurrency(activity.price_cents)}
                    <span className="font-normal text-charcoal-lighter text-xs ml-1">
                      {t("perPerson")}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
