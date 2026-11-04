import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SIDEBAR, PAGES, canAccess } from '../permissions';

const linkClass = (extra = '') => ({ isActive }) => 'sidebar-link' + (extra ? ' ' + extra : '') + (isActive ? ' active' : '');

function isOnPage(pathname, pageKey) {
  const path = PAGES[pageKey].path;
  return pathname === path || pathname.startsWith(path + '/');
}

// The sidebar menu, built from SIDEBAR in permissions.js and filtered by the
// user's access. Groups expand/collapse with a chevron, auto-open when the
// current route is one of their children, and clicking a collapsed group
// header opens it and goes to its first child.
export default function SidebarNav({ profile, onNavigate }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState({});

  const entries = SIDEBAR.map((entry) => {
    if (entry.page) return canAccess(profile, entry.page) ? entry : null;
    const children = entry.children.filter((c) => canAccess(profile, c.page));
    return children.length ? { ...entry, children } : null;
  }).filter(Boolean);

  // Keep a group open while one of its pages is the current route.
  const activeGroup = entries.find((e) => e.group && e.children.some((c) => isOnPage(pathname, c.page)))?.group;
  useEffect(() => {
    if (activeGroup) setOpen((o) => (o[activeGroup] === true ? o : { ...o, [activeGroup]: true }));
  }, [activeGroup]);

  return (
    <nav className="sidebar-nav">
      {entries.map((entry) => {
        // A plain page, or a group with a single visible child (shown flat).
        const single = entry.page ? entry : entry.children.length === 1 ? entry.children[0] : null;
        if (single) {
          return (
            <NavLink key={single.page} to={PAGES[single.page].path} className={linkClass()} onClick={onNavigate}>
              <span className="icon-dot" /> {single.label}
            </NavLink>
          );
        }

        const hasActive = entry.group === activeGroup;
        const isOpen = open[entry.group] ?? hasActive;
        return (
          <div key={entry.group}>
            <button
              type="button"
              className={'sidebar-group-header' + (isOpen ? ' open' : '') + (hasActive ? ' has-active' : '')}
              aria-expanded={isOpen}
              onClick={() => {
                if (isOpen) {
                  setOpen((o) => ({ ...o, [entry.group]: false }));
                } else {
                  setOpen((o) => ({ ...o, [entry.group]: true }));
                  if (!hasActive) navigate(PAGES[entry.children[0].page].path);
                }
              }}
            >
              <span className="icon-dot" /> {entry.label}
              <span className="sidebar-chevron" />
            </button>
            {isOpen && (
              <div className="sidebar-children">
                {entry.children.map((child) => (
                  <NavLink key={child.page} to={PAGES[child.page].path} className={linkClass('sidebar-child')} onClick={onNavigate}>
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
