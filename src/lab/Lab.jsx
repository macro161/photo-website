/**
 * "Lab": experimental pages combining AllTrails hike data with the photos.
 * Routes: #/lab (index), #/lab/<slug>. Each page is lazy-loaded from
 * src/lab/pages/ so the main gallery bundle is not affected.
 */
import { lazy, Suspense } from 'react'

export const LAB_PAGES = [
  { slug: 'elevation', title: 'Elevation contact sheet', blurb: 'Each hike as an elevation profile, with its frames along the climb.', Page: lazy(() => import('./pages/Elevation.jsx')) },
  { slug: 'strip', title: 'Film-edge stat strips', blurb: 'Hike stats printed like the edge of a 35mm negative.', Page: lazy(() => import('./pages/Strip.jsx')) },
  { slug: 'map', title: 'Map of everything', blurb: 'Every hike on one map, pinned with its cover photo.', Page: lazy(() => import('./pages/MapPage.jsx')) },
  { slug: 'vertical', title: 'Vertical meters', blurb: 'All the climbing stacked into one tower you scroll up.', Page: lazy(() => import('./pages/Vertical.jsx')) },
  { slug: 'valsorey-track', title: 'Valsorey with its track', blurb: 'The Cabane de Valsorey photos over their GPS ascent and descent, with a route view and stats.', Page: lazy(() => import('./pages/ValsoreyTrack.jsx')) },
  { slug: 'walkthrough', title: 'Trail walkthrough', blurb: 'Scroll along a route as its photos appear.', Page: lazy(() => import('./pages/Walkthrough.jsx')) },
]

export default function Lab({ slug }) {
  const page = LAB_PAGES.find((p) => p.slug === slug)
  if (!page) {
    return (
      <section className="lab-index">
        <h2>Lab</h2>
        <p>Experiments combining hike data with photos.</p>
        <ul>
          {LAB_PAGES.map((p) => (
            <li key={p.slug}>
              <a href={`#/lab/${p.slug}`}>{p.title}</a> — {p.blurb}
            </li>
          ))}
        </ul>
      </section>
    )
  }
  const { Page } = page
  return (
    <Suspense fallback={<p style={{ padding: '2rem', minHeight: '100vh' }}>Loading…</p>}>
      <Page />
    </Suspense>
  )
}
