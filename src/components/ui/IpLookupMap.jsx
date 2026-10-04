import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Default Leaflet marker icons reference image URLs that don't resolve correctly under Vite's bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Esri Dark Gray Canvas — free, keyless dark basemap.
// Two layers: base fill + reference overlay (labels/borders).
const BASE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const REFERENCE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community'
// Native tiles stop at z16; Leaflet upsamples past that instead of going blank.
const TILE_MAX_NATIVE_ZOOM = 16
const TILE_MAX_ZOOM = 18

export default function IpLookupMap({ latitude, longitude, label }) {
  const position = [latitude, longitude]

  return (
    <MapContainer
      center={position}
      zoom={10}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', background: 'var(--color-background)' }}
      key={`${latitude}-${longitude}`}
    >
      <TileLayer
        url={BASE_TILE_URL}
        attribution={TILE_ATTRIBUTION}
        maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
        maxZoom={TILE_MAX_ZOOM}
      />
      <TileLayer
        url={REFERENCE_TILE_URL}
        maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
        maxZoom={TILE_MAX_ZOOM}
      />
      <Marker position={position} icon={defaultIcon}>
        {label && <Popup>{label}</Popup>}
      </Marker>
    </MapContainer>
  )
}