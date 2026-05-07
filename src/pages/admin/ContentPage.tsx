import React from 'react';
import { useParams } from 'react-router-dom';
import { Search, X, Edit2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { craftspeopleApi, cmsApi } from '../../api/adminApi';
import type { Craftsperson, LookbookItem, JournalPost, CustomerStory } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ContentPage.module.css';

type Section = 'lookbook' | 'craftspeople' | 'stories' | 'journal';

const asCraftspeopleArray = (data: unknown): Craftsperson[] =>
  Array.isArray(data) ? data : [];

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const ContentPage: React.FC = () => {
  const { section = 'lookbook' } = useParams<{ section?: string }>();
  const [search, setSearch] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  // Craftspeople state
  const [craftspeople, setCraftspeople] = React.useState<Craftsperson[]>([]);
  const [craftLoading, setCraftLoading] = React.useState(false);
  const [craftError, setCraftError] = React.useState('');
  const [editTarget, setEditTarget] = React.useState<Craftsperson | null>(null);
  const [editBio, setEditBio] = React.useState('');
  const [editYears, setEditYears] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Lookbook state
  const [lookbookItems, setLookbookItems] = React.useState<LookbookItem[]>([]);
  const [lookbookLoading, setLookbookLoading] = React.useState(false);
  const [lookbookModal, setLookbookModal] = React.useState<LookbookItem | null | 'new'>(null);
  const [lbForm, setLbForm] = React.useState({ title: '', description: '', tags: '', published: false, sort_order: '0' });
  const [lbSaving, setLbSaving] = React.useState(false);

  // Stories state
  const [stories, setStories] = React.useState<CustomerStory[]>([]);
  const [storiesLoading, setStoriesLoading] = React.useState(false);
  const [storyModal, setStoryModal] = React.useState<CustomerStory | null | 'new'>(null);
  const [stForm, setStForm] = React.useState({ customer_name: '', location: '', story_text: '', product_name: '', rating: '', published: false });
  const [stSaving, setStSaving] = React.useState(false);

  // Journal state
  const [posts, setPosts] = React.useState<JournalPost[]>([]);
  const [postsLoading, setPostsLoading] = React.useState(false);
  const [postModal, setPostModal] = React.useState<JournalPost | null | 'new'>(null);
  const [jpForm, setJpForm] = React.useState({ title: '', slug: '', excerpt: '', body: '', status: 'draft' as 'draft' | 'published' | 'archived' });
  const [jpSaving, setJpSaving] = React.useState(false);

  const validSection = (section as Section) in { lookbook: 1, craftspeople: 1, stories: 1, journal: 1 }
    ? (section as Section) : 'lookbook';

  const debouncedSearch = useDebounce(search, 300);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setSearch('');
    if (validSection === 'craftspeople') {
      setCraftLoading(true); setCraftError('');
      craftspeopleApi.list()
        .then(data => setCraftspeople(asCraftspeopleArray(data)))
        .catch(e => setCraftError(e instanceof Error ? e.message : 'Failed to load craftspeople'))
        .finally(() => setCraftLoading(false));
    } else if (validSection === 'lookbook') {
      setLookbookLoading(true);
      cmsApi.lookbook.list()
        .then(setLookbookItems)
        .catch(e => showToast('error', 'Failed to load lookbook', e instanceof Error ? e.message : undefined))
        .finally(() => setLookbookLoading(false));
    } else if (validSection === 'stories') {
      setStoriesLoading(true);
      cmsApi.stories.list()
        .then(setStories)
        .catch(e => showToast('error', 'Failed to load stories', e instanceof Error ? e.message : undefined))
        .finally(() => setStoriesLoading(false));
    } else if (validSection === 'journal') {
      setPostsLoading(true);
      cmsApi.journal.list()
        .then(setPosts)
        .catch(e => showToast('error', 'Failed to load journal', e instanceof Error ? e.message : undefined))
        .finally(() => setPostsLoading(false));
    }
  }, [validSection]);

  // ── Craftspeople handlers ──────────────────────────────────────────────────
  const openEdit = (p: Craftsperson) => {
    setEditTarget(p); setEditBio(p.bio ?? ''); setEditYears(p.years_experience != null ? String(p.years_experience) : '');
  };

  const handleSaveCraft = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const updated = await craftspeopleApi.updateStory(editTarget.id, {
        bio: editBio, years_experience: editYears ? parseInt(editYears) : undefined,
      });
      setCraftspeople(prev => prev.map(p => p.id === updated.id ? { ...p, bio: updated.bio, years_experience: updated.years_experience } : p));
      setEditTarget(null);
      showToast('success', 'Saved', editTarget.name);
    } catch (e) { showToast('error', 'Save failed', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  };

  // ── Lookbook handlers ──────────────────────────────────────────────────────
  const openLookbook = (item: LookbookItem | 'new') => {
    if (item === 'new') {
      setLbForm({ title: '', description: '', tags: '', published: false, sort_order: '0' });
    } else {
      setLbForm({ title: item.title, description: item.description ?? '', tags: (item.tags ?? []).join(', '), published: item.published, sort_order: String(item.sort_order) });
    }
    setLookbookModal(item);
  };

  const handleSaveLookbook = async () => {
    if (!lbForm.title.trim()) { showToast('error', 'Title is required'); return; }
    setLbSaving(true);
    try {
      const payload = {
        title: lbForm.title.trim(),
        description: lbForm.description || undefined,
        tags: lbForm.tags ? lbForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        published: lbForm.published,
        sort_order: parseInt(lbForm.sort_order) || 0,
      };
      if (lookbookModal === 'new') {
        const created = await cmsApi.lookbook.create(payload);
        setLookbookItems(prev => [created, ...prev]);
        showToast('success', 'Item added');
      } else if (lookbookModal) {
        const updated = await cmsApi.lookbook.update(lookbookModal.id, payload);
        setLookbookItems(prev => prev.map(i => i.id === updated.id ? updated : i));
        showToast('success', 'Saved');
      }
      setLookbookModal(null);
    } catch (e) { showToast('error', 'Save failed', e instanceof Error ? e.message : undefined); }
    finally { setLbSaving(false); }
  };

  const handleDeleteLookbook = async (id: string) => {
    try {
      await cmsApi.lookbook.delete(id);
      setLookbookItems(prev => prev.filter(i => i.id !== id));
      showToast('success', 'Deleted');
    } catch (e) { showToast('error', 'Delete failed', e instanceof Error ? e.message : undefined); }
  };

  const handleToggleLookbook = async (item: LookbookItem) => {
    try {
      const updated = await cmsApi.lookbook.update(item.id, { published: !item.published });
      setLookbookItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch (e) { showToast('error', 'Failed', e instanceof Error ? e.message : undefined); }
  };

  // ── Stories handlers ───────────────────────────────────────────────────────
  const openStory = (story: CustomerStory | 'new') => {
    if (story === 'new') {
      setStForm({ customer_name: '', location: '', story_text: '', product_name: '', rating: '', published: false });
    } else {
      setStForm({ customer_name: story.customer_name, location: story.location ?? '', story_text: story.story_text, product_name: story.product_name ?? '', rating: story.rating != null ? String(story.rating) : '', published: story.published });
    }
    setStoryModal(story);
  };

  const handleSaveStory = async () => {
    if (!stForm.customer_name.trim() || !stForm.story_text.trim()) { showToast('error', 'Customer name and story text are required'); return; }
    setStSaving(true);
    try {
      const payload = {
        customer_name: stForm.customer_name.trim(),
        location: stForm.location || undefined,
        story_text: stForm.story_text.trim(),
        product_name: stForm.product_name || undefined,
        rating: stForm.rating ? parseInt(stForm.rating) : undefined,
        published: stForm.published,
      };
      if (storyModal === 'new') {
        const created = await cmsApi.stories.create(payload);
        setStories(prev => [created, ...prev]);
        showToast('success', 'Story added');
      } else if (storyModal) {
        const updated = await cmsApi.stories.update(storyModal.id, payload);
        setStories(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('success', 'Saved');
      }
      setStoryModal(null);
    } catch (e) { showToast('error', 'Save failed', e instanceof Error ? e.message : undefined); }
    finally { setStSaving(false); }
  };

  const handleDeleteStory = async (id: string) => {
    try {
      await cmsApi.stories.delete(id);
      setStories(prev => prev.filter(s => s.id !== id));
      showToast('success', 'Deleted');
    } catch (e) { showToast('error', 'Delete failed', e instanceof Error ? e.message : undefined); }
  };

  const handleToggleStory = async (story: CustomerStory) => {
    try {
      const updated = await cmsApi.stories.update(story.id, { published: !story.published });
      setStories(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (e) { showToast('error', 'Failed', e instanceof Error ? e.message : undefined); }
  };

  // ── Journal handlers ───────────────────────────────────────────────────────
  const slugify = (val: string) =>
    val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  const openPost = (post: JournalPost | 'new') => {
    if (post === 'new') {
      setJpForm({ title: '', slug: '', excerpt: '', body: '', status: 'draft' });
    } else {
      setJpForm({ title: post.title, slug: post.slug, excerpt: post.excerpt ?? '', body: post.body ?? '', status: post.status });
    }
    setPostModal(post);
  };

  const handleSavePost = async () => {
    if (!jpForm.title.trim() || !jpForm.slug.trim()) { showToast('error', 'Title and slug are required'); return; }
    setJpSaving(true);
    try {
      const payload = {
        title: jpForm.title.trim(),
        slug: jpForm.slug.trim(),
        excerpt: jpForm.excerpt || undefined,
        body: jpForm.body || undefined,
        status: jpForm.status,
      };
      if (postModal === 'new') {
        const created = await cmsApi.journal.create(payload);
        setPosts(prev => [created, ...prev]);
        showToast('success', 'Post created');
      } else if (postModal) {
        const updated = await cmsApi.journal.update(postModal.id, payload);
        setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
        showToast('success', 'Saved');
      }
      setPostModal(null);
    } catch (e) { showToast('error', 'Save failed', e instanceof Error ? e.message : undefined); }
    finally { setJpSaving(false); }
  };

  const handleDeletePost = async (id: string) => {
    try {
      await cmsApi.journal.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      showToast('success', 'Deleted');
    } catch (e) { showToast('error', 'Delete failed', e instanceof Error ? e.message : undefined); }
  };

  // ── Section titles ─────────────────────────────────────────────────────────
  const TITLES: Record<Section, string> = {
    lookbook: 'Lookbook', craftspeople: 'Craftspeople', stories: 'Customer Stories', journal: 'Journal',
  };

  // ── Craftspeople filtered list ─────────────────────────────────────────────
  const craftspeopleList = Array.isArray(craftspeople) ? craftspeople : [];
  const filteredCraft = craftspeopleList.filter(p =>
    !debouncedSearch || (p.name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) || (p.role ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const filteredLookbook = lookbookItems.filter(i =>
    !debouncedSearch || i.title.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  const filteredStories = stories.filter(s =>
    !debouncedSearch || s.customer_name.toLowerCase().includes(debouncedSearch.toLowerCase()) || (s.product_name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  const filteredPosts = posts.filter(p =>
    !debouncedSearch || p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || p.slug.includes(debouncedSearch.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{TITLES[validSection]}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {validSection === 'lookbook' && (
            <button className={styles.addBtn} onClick={() => openLookbook('new')}><Plus size={14}/> Add Item</button>
          )}
          {validSection === 'stories' && (
            <button className={styles.addBtn} onClick={() => openStory('new')}><Plus size={14}/> Add Story</button>
          )}
          {validSection === 'journal' && (
            <button className={styles.addBtn} onClick={() => openPost('new')}><Plus size={14}/> New Post</button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {search && <button className={styles.clearBtn} onClick={() => setSearch('')}><X size={14}/> Clear</button>}
      </div>

      {/* ── Lookbook ─────────────────────────────────────────────────────── */}
      {validSection === 'lookbook' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Title</th><th>Description</th><th>Tags</th><th>Sort</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {lookbookLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
              )) : filteredLookbook.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>
                  {lookbookItems.length === 0 ? 'No lookbook items yet. Use "Add Item" to create the first one.' : 'No matches.'}
                </td></tr>
              ) : filteredLookbook.map(item => (
                <tr key={item.id} className={styles.row}>
                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{item.description || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{(item.tags ?? []).join(', ') || '—'}</td>
                  <td>{item.sort_order}</td>
                  <td>
                    <span className={`${styles.statusPill} ${item.published ? styles.statusActive : styles.statusDraft}`}>
                      {item.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleToggleLookbook(item)} title={item.published ? 'Unpublish' : 'Publish'}>
                        {item.published ? <EyeOff size={13}/> : <Eye size={13}/>}
                      </button>
                      <button className={styles.actionBtn} onClick={() => openLookbook(item)}><Edit2 size={13}/></button>
                      <button className={styles.actionBtn} style={{ color: 'var(--color-error)' }} onClick={() => handleDeleteLookbook(item.id)}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Customer Stories ──────────────────────────────────────────────── */}
      {validSection === 'stories' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Customer</th><th>Location</th><th>Product</th><th>Rating</th><th>Story</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {storiesLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
              )) : filteredStories.length === 0 ? (
                <tr><td colSpan={7} className={styles.empty}>
                  {stories.length === 0 ? 'No customer stories yet. Use "Add Story" to create the first one.' : 'No matches.'}
                </td></tr>
              ) : filteredStories.map(story => (
                <tr key={story.id} className={styles.row}>
                  <td style={{ fontWeight: 500 }}>{story.customer_name}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{story.location || '—'}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{story.product_name || '—'}</td>
                  <td>{story.rating ? `${story.rating} ★` : '—'}</td>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--color-text-secondary)' }}>{story.story_text}</td>
                  <td>
                    <span className={`${styles.statusPill} ${story.published ? styles.statusActive : styles.statusDraft}`}>
                      {story.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleToggleStory(story)} title={story.published ? 'Unpublish' : 'Publish'}>
                        {story.published ? <EyeOff size={13}/> : <Eye size={13}/>}
                      </button>
                      <button className={styles.actionBtn} onClick={() => openStory(story)}><Edit2 size={13}/></button>
                      <button className={styles.actionBtn} style={{ color: 'var(--color-error)' }} onClick={() => handleDeleteStory(story.id)}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Journal ───────────────────────────────────────────────────────── */}
      {validSection === 'journal' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Title</th><th>Slug</th><th>Excerpt</th><th>Status</th><th>Published</th><th>Actions</th></tr></thead>
            <tbody>
              {postsLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
              )) : filteredPosts.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>
                  {posts.length === 0 ? 'No journal posts yet. Use "New Post" to write the first article.' : 'No matches.'}
                </td></tr>
              ) : filteredPosts.map(post => (
                <tr key={post.id} className={styles.row}>
                  <td style={{ fontWeight: 500 }}>{post.title}</td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>{post.slug}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', fontSize: 13 }}>{post.excerpt || '—'}</td>
                  <td>
                    <span className={`${styles.statusPill} ${post.status === 'published' ? styles.statusActive : post.status === 'archived' ? styles.statusArchived : styles.statusDraft}`}>
                      {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => openPost(post)}><Edit2 size={13}/> Edit</button>
                      <button className={styles.actionBtn} style={{ color: 'var(--color-error)' }} onClick={() => handleDeletePost(post.id)}><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Craftspeople ─────────────────────────────────────────────────── */}
      {validSection === 'craftspeople' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Role</th><th>Bio</th><th>Experience</th><th>Actions</th></tr></thead>
            <tbody>
              {craftLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
              )) : craftError ? (
                <tr><td colSpan={5} className={styles.empty}>
                  <div style={{ color: 'var(--color-error)' }}>{craftError}</div>
                  <button className={styles.actionBtn} style={{ marginTop: 8 }} onClick={() => {
                    setCraftError(''); setCraftLoading(true);
                    craftspeopleApi.list().then(data => setCraftspeople(asCraftspeopleArray(data))).catch(e => setCraftError(e instanceof Error ? e.message : 'Failed')).finally(() => setCraftLoading(false));
                  }}>Retry</button>
                </td></tr>
              ) : filteredCraft.length === 0 ? (
                <tr><td colSpan={5} className={styles.empty}>
                  {craftspeopleList.length === 0 ? 'No craftspeople records found.' : 'No matches.'}
                </td></tr>
              ) : filteredCraft.map(p => (
                <tr key={p.id} className={styles.row}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.public_photo_url && <img src={p.public_photo_url} alt={p.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />}
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                  </td>
                  <td>{p.role}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.bio || '—'}</td>
                  <td>{p.years_experience != null ? `${p.years_experience} yrs` : '—'}</td>
                  <td><button className={styles.actionBtn} onClick={() => openEdit(p)}><Edit2 size={13}/> Edit Story</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Lookbook modal ───────────────────────────────────────────────── */}
      {lookbookModal !== null && (
        <div className={styles.modalOverlay} onClick={() => setLookbookModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{lookbookModal === 'new' ? 'Add Lookbook Item' : 'Edit Lookbook Item'}</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Title *</label>
                <input className={styles.fieldInput} value={lbForm.title} onChange={e => setLbForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Wedding Season Collection" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Description</label>
                <textarea className={styles.fieldInput} style={{ height: 80, resize: 'vertical' }} value={lbForm.description} onChange={e => setLbForm(f => ({ ...f, description: e.target.value }))} placeholder="Short caption…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Tags (comma-separated)</label>
                <input className={styles.fieldInput} value={lbForm.tags} onChange={e => setLbForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g., wedding, festive, kurta" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Sort Order</label>
                  <input className={styles.fieldInput} type="number" min="0" value={lbForm.sort_order} onChange={e => setLbForm(f => ({ ...f, sort_order: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Status</label>
                  <select className={styles.fieldSelect} value={lbForm.published ? 'published' : 'draft'} onChange={e => setLbForm(f => ({ ...f, published: e.target.value === 'published' }))}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setLookbookModal(null)}>Cancel</button>
              <button className={styles.createBtn} disabled={lbSaving} onClick={handleSaveLookbook}>
                {lbSaving ? 'Saving…' : lookbookModal === 'new' ? 'Add Item' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Story modal ──────────────────────────────────────────────────── */}
      {storyModal !== null && (
        <div className={styles.modalOverlay} onClick={() => setStoryModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 className={styles.modalTitle}>{storyModal === 'new' ? 'Add Customer Story' : 'Edit Story'}</h3>
            <div className={styles.fields}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Customer Name *</label>
                  <input className={styles.fieldInput} value={stForm.customer_name} onChange={e => setStForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Full name" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Location</label>
                  <input className={styles.fieldInput} value={stForm.location} onChange={e => setStForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g., Mumbai" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Product</label>
                  <input className={styles.fieldInput} value={stForm.product_name} onChange={e => setStForm(f => ({ ...f, product_name: e.target.value }))} placeholder="e.g., Wedding Sherwani" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Rating (1–5)</label>
                  <select className={styles.fieldSelect} value={stForm.rating} onChange={e => setStForm(f => ({ ...f, rating: e.target.value }))}>
                    <option value="">— None —</option>
                    {[1,2,3,4,5].map(r => <option key={r} value={r}>{r} ★</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Story Text *</label>
                <textarea className={styles.fieldInput} style={{ height: 100, resize: 'vertical' }} value={stForm.story_text} onChange={e => setStForm(f => ({ ...f, story_text: e.target.value }))} placeholder="Customer's experience in their own words…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Status</label>
                <select className={styles.fieldSelect} value={stForm.published ? 'published' : 'draft'} onChange={e => setStForm(f => ({ ...f, published: e.target.value === 'published' }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setStoryModal(null)}>Cancel</button>
              <button className={styles.createBtn} disabled={stSaving} onClick={handleSaveStory}>
                {stSaving ? 'Saving…' : storyModal === 'new' ? 'Add Story' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Journal post modal ───────────────────────────────────────────── */}
      {postModal !== null && (
        <div className={styles.modalOverlay} onClick={() => setPostModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h3 className={styles.modalTitle}>{postModal === 'new' ? 'New Journal Post' : 'Edit Post'}</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Title *</label>
                <input className={styles.fieldInput} value={jpForm.title} onChange={e => {
                  const t = e.target.value;
                  setJpForm(f => ({ ...f, title: t, slug: f.slug || slugify(t) }));
                }} placeholder="Post title" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Slug * (URL-safe, e.g. my-post-title)</label>
                <input className={styles.fieldInput} value={jpForm.slug} onChange={e => setJpForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="my-post-title" style={{ fontFamily: 'monospace' }} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Excerpt</label>
                <textarea className={styles.fieldInput} style={{ height: 70, resize: 'vertical' }} value={jpForm.excerpt} onChange={e => setJpForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short description shown in listings…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Body</label>
                <textarea className={styles.fieldInput} style={{ height: 160, resize: 'vertical' }} value={jpForm.body} onChange={e => setJpForm(f => ({ ...f, body: e.target.value }))} placeholder="Full article content…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Status</label>
                <select className={styles.fieldSelect} value={jpForm.status} onChange={e => setJpForm(f => ({ ...f, status: e.target.value as 'draft' | 'published' | 'archived' }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setPostModal(null)}>Cancel</button>
              <button className={styles.createBtn} disabled={jpSaving} onClick={handleSavePost}>
                {jpSaving ? 'Saving…' : postModal === 'new' ? 'Create Post' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Craftspeople edit modal ───────────────────────────────────────── */}
      {editTarget && (
        <div className={styles.modalOverlay} onClick={() => setEditTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Edit — {editTarget.name}</h3>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Bio</label>
                <textarea className={styles.fieldInput} style={{ minHeight: 120, resize: 'vertical' }} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Craftsperson's story and background…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Years of Experience</label>
                <input type="number" className={styles.fieldInput} value={editYears} onChange={e => setEditYears(e.target.value)} min="0" />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setEditTarget(null)}>Cancel</button>
              <button className={styles.createBtn} disabled={saving} onClick={handleSaveCraft}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
