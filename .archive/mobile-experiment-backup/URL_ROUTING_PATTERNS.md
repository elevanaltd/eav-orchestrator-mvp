# URL Routing Patterns from Mobile Work

## Valuable URL Structure (5 minutes to implement)

The mobile work established a clean URL routing pattern for shareability:

```typescript
// App.tsx Route Structure
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />
  <Route path="/" element={<PrivateRoute><MainApp /></PrivateRoute>} />

  // Project-level routing
  <Route path="/project/:projectId" element={<PrivateRoute><MainApp /></PrivateRoute>} />

  // Video-level routing
  <Route path="/project/:projectId/video/:videoId" element={<PrivateRoute><MainApp /></PrivateRoute>} />

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

## Navigation Pattern (from BreadcrumbNavigation.tsx)

The mobile work demonstrated URL-driven navigation patterns:

```typescript
// Navigate to project level
navigate(`/project/${currentProject.id}`)

// Video-specific URLs would be:
// /project/{projectId}/video/{videoId}
```

## Implementation Value

- **Shareability**: Users can share direct links to specific projects/videos
- **Browser history**: Back/forward navigation works correctly
- **Bookmarking**: URLs represent actual application state
- **Mobile-first**: Pattern designed for mobile URL sharing

## Implementation Time: ~5 minutes
- URL patterns already proven
- Navigation logic tested and working
- Just needs desktop implementation (no mobile-specific code)