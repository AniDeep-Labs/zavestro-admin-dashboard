import React from 'react';
import { useParams } from 'react-router-dom';
import { cmsApi } from '../../api/adminApi';
import type { LookbookItem, JournalPost, CustomerStory } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './ContentPage.module.css';
import { UilEditAlt, UilEye, UilEyeSlash, UilPlus, UilSearch, UilTimes, UilTrashAlt } from "@iconscout/react-unicons";
import { StatusBadge } from '../../components';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal/Modal';

// 'craftspeople' section removed (G-20): artisan-brand model retired.
type Section = 'lookbook' | 'stories' | 'journal';

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

export const ContentPage: React.FC = () => {
  const { section = 'lookbook' } = useParams<{ section?: string }>();
  const [search, setSearch] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

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

  // Single confirm gate for all three destructive deletes (were firing on one click).
  const [pendingDelete, setPendingDelete] = React.useState<
    null | { kind: 'lookbook' | 'story' | 'post'; id: string; name: string }
  >(null);
  const [deleting, setDeleting] = React.useState(false);

  const validSection = (section as Section) in { lookbook: 1, stories: 1, journal: 1 }
    ? (section as Section) : 'lookbook';

  const debouncedSearch = useDebounce(search, 300);

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setSearch('');
    if (validSection === 'lookbook') {
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

  const DELETE_KIND_LABEL: Record<'lookbook' | 'story' | 'post', string> = {
    lookbook: 'lookbook item', story: 'customer story', post: 'journal post',
  };
  const runDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'lookbook') await handleDeleteLookbook(pendingDelete.id);
      else if (pendingDelete.kind === 'story') await handleDeleteStory(pendingDelete.id);
      else await handleDeletePost(pendingDelete.id);
    } finally { setDeleting(false); setPendingDelete(null); }
  };

  // ── Section titles ─────────────────────────────────────────────────────────
  const TITLES: Record<Section, string> = {
    lookbook: 'Lookbook', stories: 'Customer Stories', journal: 'Journal',
  };

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
        <div className={styles.headerActions}>
          {validSection === 'lookbook' && (
            <button className={styles.addBtn} onClick={() => openLookbook('new')}><UilPlus size={14}/> Add Item</button>
          )}
          {validSection === 'stories' && (
            <button className={styles.addBtn} onClick={() => openStory('new')}><UilPlus size={14}/> Add Story</button>
          )}
          {validSection === 'journal' && (
            <button className={styles.addBtn} onClick={() => openPost('new')}><UilPlus size={14}/> New Post</button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {search && <button className={styles.clearBtn} onClick={() => setSearch('')}><UilTimes size={14}/> Clear</button>}
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
                  <td className={styles.nameCell}>{item.title}</td>
                  <td className={styles.descCell}>{item.description || '—'}</td>
                  <td className={styles.tagsCell}>{(item.tags ?? []).join(', ') || '—'}</td>
                  <td>{item.sort_order}</td>
                  <td>
                    <StatusBadge status={item.published ? 'published' : 'draft'} />
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleToggleLookbook(item)} title={item.published ? 'Unpublish' : 'Publish'} aria-label={item.published ? 'Unpublish item' : 'Publish item'}>
                        {item.published ? <UilEyeSlash size={13}/> : <UilEye size={13}/>}
                      </button>
                      <button className={styles.actionBtn} onClick={() => openLookbook(item)} aria-label="Edit item"><UilEditAlt size={13}/></button>
                      <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => setPendingDelete({ kind: 'lookbook', id: item.id, name: item.title })} aria-label="Delete item"><UilTrashAlt size={13}/></button>
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
                  <td className={styles.nameCell}>{story.customer_name}</td>
                  <td className={styles.mutedCell}>{story.location || '—'}</td>
                  <td className={styles.mutedCell}>{story.product_name || '—'}</td>
                  <td>{story.rating ? `${story.rating} ★` : '—'}</td>
                  <td className={styles.storyCell}>{story.story_text}</td>
                  <td>
                    <StatusBadge status={story.published ? 'published' : 'draft'} />
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => handleToggleStory(story)} title={story.published ? 'Unpublish' : 'Publish'} aria-label={story.published ? 'Unpublish story' : 'Publish story'}>
                        {story.published ? <UilEyeSlash size={13}/> : <UilEye size={13}/>}
                      </button>
                      <button className={styles.actionBtn} onClick={() => openStory(story)} aria-label="Edit story"><UilEditAlt size={13}/></button>
                      <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => setPendingDelete({ kind: 'story', id: story.id, name: story.customer_name })} aria-label="Delete story"><UilTrashAlt size={13}/></button>
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
                  <td className={styles.nameCell}>{post.title}</td>
                  <td className={styles.slugCell}>{post.slug}</td>
                  <td className={styles.excerptCell}>{post.excerpt || '—'}</td>
                  <td>
                    <StatusBadge status={post.status} />
                  </td>
                  <td className={styles.dateCell}>
                    {post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => openPost(post)}><UilEditAlt size={13}/> Edit</button>
                      <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => setPendingDelete({ kind: 'post', id: post.id, name: post.title })} aria-label="Delete post"><UilTrashAlt size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Lookbook modal ───────────────────────────────────────────────── */}
      <Modal
        open={lookbookModal !== null}
        onClose={() => setLookbookModal(null)}
        title={lookbookModal === 'new' ? 'Add Lookbook Item' : 'Edit Lookbook Item'}
        size="md"
        footer={
          <div className={styles.modalActions}>
            <button className={styles.cancelModalBtn} onClick={() => setLookbookModal(null)}>Cancel</button>
            <button className={styles.createBtn} disabled={lbSaving} onClick={handleSaveLookbook}>
              {lbSaving ? 'Saving…' : lookbookModal === 'new' ? 'Add Item' : 'Save'}
            </button>
          </div>
        }
      >
        {lookbookModal !== null && (
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Title *</label>
                <input className={styles.fieldInput} value={lbForm.title} onChange={e => setLbForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Wedding Season Collection" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Description</label>
                <textarea className={`${styles.fieldInput} ${styles.descTa}`} value={lbForm.description} onChange={e => setLbForm(f => ({ ...f, description: e.target.value }))} placeholder="Short caption…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Tags (comma-separated)</label>
                <input className={styles.fieldInput} value={lbForm.tags} onChange={e => setLbForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g., wedding, festive, kurta" />
              </div>
              <div className={styles.formGrid2}>
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
        )}
      </Modal>

      {/* ── Story modal ──────────────────────────────────────────────────── */}
      <Modal
        open={storyModal !== null}
        onClose={() => setStoryModal(null)}
        title={storyModal === 'new' ? 'Add Customer Story' : 'Edit Story'}
        size="md"
        footer={
          <div className={styles.modalActions}>
            <button className={styles.cancelModalBtn} onClick={() => setStoryModal(null)}>Cancel</button>
            <button className={styles.createBtn} disabled={stSaving} onClick={handleSaveStory}>
              {stSaving ? 'Saving…' : storyModal === 'new' ? 'Add Story' : 'Save'}
            </button>
          </div>
        }
      >
        {storyModal !== null && (
            <div className={styles.fields}>
              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Customer Name *</label>
                  <input className={styles.fieldInput} value={stForm.customer_name} onChange={e => setStForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Full name" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Location</label>
                  <input className={styles.fieldInput} value={stForm.location} onChange={e => setStForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g., Mumbai" />
                </div>
              </div>
              <div className={styles.formGrid2}>
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
                <textarea className={`${styles.fieldInput} ${styles.storyTa}`} value={stForm.story_text} onChange={e => setStForm(f => ({ ...f, story_text: e.target.value }))} placeholder="Customer's experience in their own words…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Status</label>
                <select className={styles.fieldSelect} value={stForm.published ? 'published' : 'draft'} onChange={e => setStForm(f => ({ ...f, published: e.target.value === 'published' }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
        )}
      </Modal>

      {/* ── Journal post modal ───────────────────────────────────────────── */}
      <Modal
        open={postModal !== null}
        onClose={() => setPostModal(null)}
        title={postModal === 'new' ? 'New Journal Post' : 'Edit Post'}
        size="lg"
        footer={
          <div className={styles.modalActions}>
            <button className={styles.cancelModalBtn} onClick={() => setPostModal(null)}>Cancel</button>
            <button className={styles.createBtn} disabled={jpSaving} onClick={handleSavePost}>
              {jpSaving ? 'Saving…' : postModal === 'new' ? 'Create Post' : 'Save'}
            </button>
          </div>
        }
      >
        {postModal !== null && (
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
                <input className={`${styles.fieldInput} ${styles.mono}`} value={jpForm.slug} onChange={e => setJpForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="my-post-title" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Excerpt</label>
                <textarea className={`${styles.fieldInput} ${styles.excerptTa}`} value={jpForm.excerpt} onChange={e => setJpForm(f => ({ ...f, excerpt: e.target.value }))} placeholder="Short description shown in listings…" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Body</label>
                <textarea className={`${styles.fieldInput} ${styles.bodyTa}`} value={jpForm.body} onChange={e => setJpForm(f => ({ ...f, body: e.target.value }))} placeholder="Full article content…" />
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
        )}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this item?"
        message={pendingDelete ? `Delete ${DELETE_KIND_LABEL[pendingDelete.kind]} “${pendingDelete.name}”? This can't be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={runDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
