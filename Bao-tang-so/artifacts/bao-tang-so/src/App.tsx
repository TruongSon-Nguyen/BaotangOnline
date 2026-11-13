import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Eye, Filter, Heart, ImagePlus, Landmark, LayoutDashboard, LockKeyhole, LogOut, Menu, Minus, Plus, Search, Settings2, ShieldCheck, Upload, X, ZoomIn } from 'lucide-react';
import {
  useGetMuseumHome, useGetMuseumIntro, useListArtifacts, useGetArtifact, useListPeriods, useListMaterials,
  useListExhibitions, useGetExhibition, useGetAdminSession, useGetAdminOverview, useListAdminArtifacts,
  useCreateArtifact, useUpdateArtifact, useDeleteArtifact, useAddArtifactImage, useUpdateArtifactImage,
  useDeleteArtifactImage, useAddImageHotspot, useUpdateImageHotspot, useDeleteImageHotspot,
  useListAdminExhibitions, useCreateExhibition, useUpdateExhibition, useDeleteExhibition,
  useUpdateMuseumIntro, useUpdateFeaturedArtifacts, useListAdminAccounts, useInviteAdmin, useRevokeAdmin,
  getGetMuseumHomeQueryKey, getGetMuseumIntroQueryKey, getListArtifactsQueryKey,
  getGetArtifactQueryKey, getListExhibitionsQueryKey, getGetExhibitionQueryKey, getGetAdminSessionQueryKey,
  getGetAdminOverviewQueryKey, getListAdminArtifactsQueryKey, getListAdminExhibitionsQueryKey,
  getListAdminAccountsQueryKey, getListPeriodsQueryKey, getListMaterialsQueryKey,
} from '@workspace/api-client-react';
import { useGetAdminArtifact, getGetAdminArtifactQueryKey } from '@workspace/api-client-react';
import type { Artifact, ArtifactImage, ArtifactSummary, Exhibition, ExhibitionSummary, Hotspot } from '@workspace/api-client-react';
import AdminExhibitionsManager from '@/components/admin-exhibitions-manager';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import '@/index.css';
import '@/museum.css';
import '@/media.css';
import '@/auth.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const imageServe = (path: string | null | undefined) => path?.startsWith('/objects/') ? `/api/storage${path}` : (path || '');
const esc = (text?: string | null) => text || '';
function SampleBadge() { return null; }

function useFavorites() {
  const [ids, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('bao-tang-favorites') || '[]'); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('bao-tang-favorites', JSON.stringify(ids)); }, [ids]);
  const toggle = (id: string) => setIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  return { ids, toggle, has: (id: string) => ids.includes(id) };
}
function BrandMark({ inverted=false }: {inverted?:boolean}) { return <Link href="/" data-testid="link-home" className={`brand ${inverted?'brand-invert':''}`}><span className="brand-emblem"><Landmark size={20}/></span><span><b>BẢO TÀNG SỐ</b><small>DI SẢN VIỆT NAM</small></span></Link>; }
type AuthMode = 'sign-in' | 'sign-up';
type AuthUser = {id:string;email:string;name:string};
function Header() {
  const [menu,setMenu]=useState(false);
  const [authMode,setAuthMode]=useState<AuthMode|null>(null);
  const [authUser,setAuthUser]=useState<AuthUser|null>(null);
  const [authError,setAuthError]=useState('');
  const [accountMenuOpen,setAccountMenuOpen]=useState(false);
  const [showQuickAdd,setShowQuickAdd]=useState(false);
  const accountMenuRef=useRef<HTMLDivElement>(null);
  const client=useQueryClient();
  const adminSession=useGetAdminSession({query:{queryKey:getGetAdminSessionQueryKey(),enabled:!!authUser,retry:false}});
  const closeAuth=useCallback(()=>setAuthMode(null),[]);
  useEffect(()=>{
    let cancelled=false;
    void fetch('/api/auth/session',{credentials:'same-origin'}).then(async response=>{
      if(response.status===401)return null;
      const payload=await response.json() as {user?:AuthUser;error?:string};
      if(!response.ok)throw new Error(payload.error||'Không thể kiểm tra phiên đăng nhập.');
      return payload.user||null;
    }).then(user=>{if(!cancelled)setAuthUser(user)}).catch(error=>{if(!cancelled)setAuthError(error instanceof Error?error.message:'Không thể kết nối máy chủ xác thực.')});
    return ()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    if(!accountMenuOpen)return;
    const closeOnOutsideClick=(event:PointerEvent)=>{if(!accountMenuRef.current?.contains(event.target as Node))setAccountMenuOpen(false)};
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setAccountMenuOpen(false)};
    document.addEventListener('pointerdown',closeOnOutsideClick);
    document.addEventListener('keydown',closeOnEscape);
    return ()=>{document.removeEventListener('pointerdown',closeOnOutsideClick);document.removeEventListener('keydown',closeOnEscape)};
  },[accountMenuOpen]);
  const signOut=async()=>{
    setAuthError('');
    try{
      const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});
      if(!response.ok)throw new Error('Không thể đăng xuất. Xin thử lại.');
      client.removeQueries({queryKey:getGetAdminSessionQueryKey()});
      setAuthUser(null);
      setAccountMenuOpen(false);
    }catch(error){setAuthError(error instanceof Error?error.message:'Không thể kết nối máy chủ xác thực.')};
  };
  return <>
    <div className="topline"><span>DI SẢN KHÔNG CÓ KHOẢNG CÁCH</span><span>KHÁM PHÁ THEO NHỊP RIÊNG CỦA BẠN</span></div>
    <header className="site-header">
      <BrandMark/>
      <nav className={menu?'nav-open':''} aria-label="Điều hướng chính">
        <Link href="/collection" data-testid="link-collection">Bộ sưu tập</Link>
        <Link href="/exhibitions" data-testid="link-exhibitions">Trưng bày</Link>
        <Link href="/favorites" data-testid="link-favorites">Đã lưu</Link>
      </nav>
      <div className="header-right">
        <Link href="/collection" className="header-search" data-testid="link-search-collection"><Search size={17}/><span>Tìm hiện vật</span></Link>
        {authUser?<>
          <div className="account-menu" ref={accountMenuRef}>
            <button className="header-account-name" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={()=>setAccountMenuOpen(open=>!open)} data-testid="button-account-menu">
              <span>{authUser.name}</span><ChevronDown size={14}/>
            </button>
            {accountMenuOpen&&<div className="account-menu-dropdown" role="menu">
              {adminSession.data?<>
                <Link href="/admin/artifacts" role="menuitem" onClick={()=>setAccountMenuOpen(false)} data-testid="link-edit-artifact">Sửa hiện vật</Link>
                <button role="menuitem" onClick={()=>{setAccountMenuOpen(false);setShowQuickAdd(true)}} data-testid="button-add-artifact">Thêm hiện vật</button>
                <Link href="/admin/accounts" role="menuitem" onClick={()=>setAccountMenuOpen(false)} data-testid="link-create-admin-account">Tạo tài khoản quản trị</Link>
              </>:<span className="account-menu-status">
                {adminSession.isLoading?'Đang kiểm tra quyền quản trị…':adminSession.isError?(adminSession.error instanceof Error?adminSession.error.message:'Không thể kiểm tra quyền quản trị.'):'Tài khoản chưa có quyền quản trị.'}
              </span>}
            </div>}
          </div>
          <button className="login-button" onClick={()=>void signOut()} data-testid="button-sign-out"><LogOut size={15}/><span>Đăng xuất</span></button>
        </>:<button className="login-button" onClick={()=>{setAuthError('');setAuthMode('sign-in')}} data-testid="button-open-sign-in"><LockKeyhole size={15}/><span>Đăng nhập</span></button>}
        <button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Mở điều hướng" data-testid="button-mobile-menu">{menu?<X/>:<Menu/>}</button>
      </div>
    </header>
    {authError&&<div className="auth-header-error" role="alert">{authError}</div>}
    {authMode&&<AuthDialog mode={authMode} onModeChange={setAuthMode} onAuthenticated={user=>{setAuthUser(user);setAuthError('')}} onClose={closeAuth}/>}
    {showQuickAdd&&<ArtifactForm onClose={()=>setShowQuickAdd(false)} onDone={()=>setShowQuickAdd(false)}/>}
  </>;
}
function AuthDialog({mode,onModeChange,onAuthenticated,onClose}:{mode:AuthMode;onModeChange:(mode:AuthMode)=>void;onAuthenticated:(user:AuthUser)=>void;onClose:()=>void}) {
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [isSubmitting,setIsSubmitting]=useState(false);
  useEffect(()=>{
    const handleKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
    window.addEventListener('keydown',handleKeyDown);
    return ()=>window.removeEventListener('keydown',handleKeyDown);
  },[onClose]);
  useEffect(()=>{setError('');setPassword('')},[mode]);
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try{
      const response=await fetch(`/api/auth/${mode==='sign-up'?'register':'login'}`,{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(mode==='sign-up'?{name,email,password}:{email,password}),
      });
      const payload=await response.json() as {user?:AuthUser;error?:string};
      if(!response.ok)throw new Error(payload.error||'Máy chủ không thể xác thực tài khoản.');
      if(!payload.user)throw new Error('Máy chủ không trả về thông tin tài khoản.');
      onAuthenticated(payload.user);
      onClose();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể kết nối máy chủ. Kiểm tra kết nối và thử lại.');
    }finally{
      setIsSubmitting(false);
    }
  };
  return <div className="auth-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
      <div className="auth-dialog-heading"><div><span className="eyebrow">BẢO TÀNG SỐ</span><h2 id="auth-dialog-title" className="editorial-title">{mode==='sign-in'?'Chào mừng trở lại':'Tạo tài khoản'}</h2></div><button className="auth-dialog-close" onClick={onClose} aria-label="Đóng cửa sổ đăng nhập" data-testid="button-close-auth"><X size={19}/></button></div>
      <form className="auth-form" onSubmit={event=>void submit(event)} noValidate>
        {mode==='sign-up'&&<label>Họ và tên<input autoComplete="name" value={name} onChange={event=>setName(event.target.value)} minLength={2} maxLength={80} required data-testid="input-auth-name"/></label>}
        <label>Email<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} required data-testid="input-auth-email"/></label>
        <label>Mật khẩu<input type="password" autoComplete={mode==='sign-up'?'new-password':'current-password'} value={password} onChange={event=>setPassword(event.target.value)} minLength={8} maxLength={128} required data-testid="input-auth-password"/>{mode==='sign-up'&&<small>Tối thiểu 8 ký tự.</small>}</label>
        {error&&<div className="auth-server-status is-error" role="alert">{error}</div>}
        <button className="auth-submit" type="submit" disabled={isSubmitting} data-testid="button-submit-auth">{isSubmitting?'Đang kết nối máy chủ…':mode==='sign-in'?'Đăng nhập':'Tạo tài khoản'}</button>
      </form>
      <p className="auth-mode-switch">{mode==='sign-in'?'Chưa có tài khoản?':'Đã có tài khoản?'} <button onClick={()=>onModeChange(mode==='sign-in'?'sign-up':'sign-in')} data-testid="button-switch-auth-mode">{mode==='sign-in'?'Đăng ký':'Đăng nhập'}</button></p>
    </section>
  </div>;
}
function Footer() { return <footer className="footer"><div className="footer-inner"><div><BrandMark inverted/><p>Mỗi hiện vật là một cánh cửa. Hãy mở theo cách của bạn.</p></div><div className="footer-links"><Link href="/collection">Khám phá hiện vật</Link><Link href="/exhibitions">Câu chuyện trưng bày</Link><Link href="/favorites">Danh sách đã lưu</Link><Link href="/admin">Không gian quản trị</Link></div><small>© BẢO TÀNG SỐ · KÝ ỨC ĐƯỢC GÌN GIỮ CÙNG NHAU</small></div></footer>; }
function PublicShell({children}: {children: React.ReactNode}) { return <div className="museum-grain"><Header/>{children}<Footer/></div>; }
function Loading({label='Đang mở cánh cửa lưu trữ…'}:{label?:string}) { return <div className="loading-state" role="status"><span className="loading-mark"/><p>{label}</p></div>; }
function Failure({retry}:{retry:()=>void}) { return <div className="state-panel"><CircleHelp/><h2>Chưa thể tải bộ sưu tập</h2><p>Xin thử lại sau ít phút. Những câu chuyện vẫn đang được gìn giữ.</p><Button onClick={retry} data-testid="button-retry">Thử lại</Button></div>; }
function PageIntro({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}) { return <section className="page-intro reveal"><span className="eyebrow">{eyebrow}</span><h1 className="editorial-title">{title}</h1>{description&&<p>{description}</p>}</section>; }

function ArtifactCard({item,index=0,favorites}:{item:ArtifactSummary;index?:number;favorites?:ReturnType<typeof useFavorites>}) {
  return <article className="artifact-card reveal" style={{animationDelay:`${Math.min(index,7)*.06}s`}} data-testid={`card-artifact-${item.id}`}>
    <Link href={`/artifacts/${item.slug || item.id}`} className="artifact-image-link" data-testid={`link-artifact-${item.id}`}>
      <div className="artifact-image"><img src={imageServe(item.imageUrl)} alt={item.name} loading="lazy"/><span className="image-index">SƯU TẬP · {String(index+1).padStart(2,'0')}</span></div>
    </Link>
    {favorites&&<button className={`favorite-button ${favorites.has(item.id)?'is-saved':''}`} aria-label={favorites.has(item.id)?'Bỏ lưu hiện vật':'Lưu hiện vật'} onClick={()=>favorites.toggle(item.id)} data-testid={`button-favorite-${item.id}`}><Heart size={17} fill={favorites.has(item.id)?'currentColor':'none'}/></button>}
    <div className="artifact-meta"><div className="tag-row"><span>{item.periodName}</span></div><Link href={`/artifacts/${item.slug || item.id}`} className="artifact-title" data-testid={`title-artifact-${item.id}`}>{item.name}</Link><p>{item.summary}</p><div className="artifact-card-foot"><span>{item.dateLabel}</span><ArrowUpRight size={16}/></div></div>
  </article>;
}
function ExhibitionCard({item,index=0}:{item:ExhibitionSummary;index?:number}) {
  return <Link href={`/exhibitions/${item.slug||item.id}`} className={`exhibition-card exhibition-card-${index%2}`} data-testid={`card-exhibition-${item.id}`}><div className="exhibition-cover"><img src={imageServe(item.coverImage)} alt={item.title} loading="lazy"/><span className="exhibition-open"><ArrowUpRight/></span></div><div className="exhibition-caption"><span className="eyebrow">PHÒNG TRƯNG BÀY · {String(index+1).padStart(2,'0')}</span><h3 className="editorial-title">{item.title}</h3><p>{item.summary}</p><small>{item.artifactCount} HIỆN VẬT</small></div></Link>;
}

function HomePage() {
  const {data, isLoading, isError, refetch}=useGetMuseumHome();
  const {ids,toggle,has}=useFavorites();
  const [periods,setPeriods]=useState<any[]>([]);
  const periodQuery=useListPeriods(); useEffect(()=>{if(periodQuery.data)setPeriods(periodQuery.data as any[])},[periodQuery.data]);
  if(isLoading)return <PublicShell><Loading/></PublicShell>;
  if(isError||!data||!data.intro)return <PublicShell><Failure retry={()=>void refetch()}/></PublicShell>;
  const intro = data.intro ?? {
    museumName: 'Bảo tàng số',
    tagline: 'Di sản Việt Nam, gần hơn một chạm.',
    story: '',
    heroImage: '',
  };
  const featuredArtifacts = data.featuredArtifacts ?? [];
  const exhibitions = data.exhibitions ?? [];
  const collectionCount = data.collectionCount ?? 0;
  return <PublicShell><main>
    <section className="hero-section"><div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot"/> MỘT KHÔNG GIAN DI SẢN MỞ</span><h1 className="editorial-title">Lịch sử sống<br/>trong <i>từng</i> chi tiết.</h1><p>{intro.tagline}</p><div className="hero-actions"><Link href="/collection" className="button-primary" data-testid="link-explore-collection"><span>Khám phá bộ sưu tập</span><ArrowRight size={18}/></Link><Link href="/exhibitions" className="text-link" data-testid="link-view-exhibitions">Thăm phòng trưng bày <ArrowUpRight size={16}/></Link></div><div className="hero-footnote"><span className="hero-rule"/>KHÔNG CẦN TÀI KHOẢN · KHÔNG CẦN VỘI VÃ</div></div><div className="hero-visual"><img src={imageServe(intro.heroImage)} alt="Không gian và hiện vật trưng bày"/><div className="hero-image-label"><span>01 / {String(collectionCount).padStart(2,'0')}</span><b>{intro.museumName}</b></div><div className="hero-stamp"><span>GÌN GIỮ</span><Landmark size={28}/><span>KỂ LẠI</span></div></div><div className="hero-side-note">DI SẢN · KÝ ỨC · NHỮNG ĐIỀU CÒN LẠI</div></section>
    <div className="home-count-strip"><span><b>{collectionCount.toLocaleString('vi-VN')}</b> hiện vật đang chờ bạn khám phá</span><span className="mono">BỘ SƯU TẬP SỐ · 01—∞</span></div>
    <section className="section-block featured-section"><div className="section-heading"><div><span className="eyebrow">NHỮNG CÂU CHUYỆN ĐƯỢC CHỌN</span><h2 className="editorial-title">Điểm chạm đầu tiên</h2></div><Link href="/collection" className="text-link" data-testid="link-all-artifacts">Tất cả hiện vật <ArrowRight size={17}/></Link></div><div className="artifact-grid">{featuredArtifacts.map((a,i)=><ArtifactCard key={a.id} item={a} index={i} favorites={{ids,toggle,has}}/>)}</div></section>
    <section className="period-section"><div className="period-copy"><span className="eyebrow">DÒNG CHẢY THỜI GIAN</span><h2 className="editorial-title">Không có lối đi<br/>duy nhất vào<br/><i>quá khứ.</i></h2><p>Mỗi thời đại để lại dấu vết theo cách riêng. Bắt đầu ở bất kỳ điểm nào, rồi để những mối liên kết dẫn bạn đi xa hơn.</p><Link className="text-link" href="/collection">Dạo theo dòng thời gian <ArrowRight size={16}/></Link></div><div className="timeline-list">{(periods.length?periods:[]).slice(0,4).map((p,i)=><Link href={`/collection?period=${p.id}`} key={p.id} className="timeline-item" data-testid={`link-period-${p.id}`}><span className="timeline-number">0{i+1}</span><span><b>{p.name}</b><small>{p.startYear} — {p.endYear}</small></span><ArrowUpRight size={17}/></Link>)}{periods.length===0&&<div className="timeline-empty">Mỗi hiện vật đều mang trong mình dấu vết của một thời đại.</div>}</div></section>
    {exhibitions.length>0&&<section className="section-block exhibition-section"><div className="section-heading"><div><span className="eyebrow">NHỮNG GÓC NHÌN CÓ CHỦ ĐÍCH</span><h2 className="editorial-title">Phòng trưng bày</h2></div><Link href="/exhibitions" className="text-link" data-testid="link-all-exhibitions">Xem tất cả <ArrowRight size={17}/></Link></div><div className="exhibition-grid">{exhibitions.slice(0,3).map((x,i)=><ExhibitionCard key={x.id} item={x} index={i}/>)}</div></section>}
    <section className="closing-note"><span className="eyebrow">BẠN CÓ THỂ BẮT ĐẦU NGAY</span><p className="editorial-title">“Không cần biết trước mọi thứ.<br/>Chỉ cần bắt đầu từ một điều khiến bạn tò mò.”</p><Link href="/collection" className="button-outline" data-testid="link-start-discovery">Tìm điều khiến bạn tò mò <ArrowRight size={16}/></Link></section>
  </main></PublicShell>;
}

function CollectionPage() {
  const params=new URLSearchParams(window.location.search);
  const [query,setQuery]=useState(params.get('q')||'');
  const [periodId,setPeriodId]=useState(params.get('period')||'');
  const [materialId,setMaterialId]=useState('');
  const [page,setPage]=useState(1);
  const apiParams=useMemo(()=>({q:query||undefined,periodId:periodId||undefined,materialId:materialId||undefined,page,limit:18}),[query,periodId,materialId,page]);
  const {data,isLoading,isError,refetch}=useListArtifacts(apiParams);
  const periods=useListPeriods(); const materials=useListMaterials(); const {ids,toggle,has}=useFavorites();
  useEffect(()=>setPage(1),[query,periodId,materialId]);
  return <PublicShell><main className="page-wrap"><PageIntro eyebrow="LƯU TRỮ MỞ · TÌM THEO CÁCH CỦA BẠN" title="Bộ sưu tập" description="Mỗi hiện vật bắt đầu một câu chuyện. Tìm kiếm theo điều bạn nhớ, hoặc để một điều mới tìm thấy bạn."/>
    <div className="collection-tools"><label className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên, chất liệu, câu chuyện…" aria-label="Tìm kiếm hiện vật" data-testid="input-search-artifacts"/>{query&&<button onClick={()=>setQuery('')} aria-label="Xóa tìm kiếm" data-testid="button-clear-search"><X size={16}/></button>}</label><div className="select-filters"><label><Filter size={15}/><select value={periodId} onChange={e=>setPeriodId(e.target.value)} aria-label="Lọc theo thời kỳ" data-testid="select-period-filter"><option value="">Mọi thời kỳ</option>{(periods.data||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={15}/></label><label><select value={materialId} onChange={e=>setMaterialId(e.target.value)} aria-label="Lọc theo chất liệu" data-testid="select-material-filter"><option value="">Mọi chất liệu</option>{(materials.data||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><ChevronDown size={15}/></label></div></div>
    <div className="results-bar"><span data-testid="text-artifact-count">{isLoading?'Đang tìm trong kho lưu trữ…':`${data?.total||0} hiện vật`}</span><span className="mono">TRANG {page} / {data?Math.max(1,Math.ceil(data.total/data.limit)):1}</span></div>
    {isLoading?<div className="artifact-grid"><div className="skeleton-card"/><div className="skeleton-card"/><div className="skeleton-card"/></div>:isError?<Failure retry={()=>void refetch()}/>:data?.items.length?<><div className="artifact-grid">{data.items.map((item,i)=><ArtifactCard item={item} key={item.id} index={i} favorites={{ids,toggle,has}}/>)}</div><div className="pagination"><button onClick={()=>setPage(Math.max(1,page-1))} disabled={page<=1} data-testid="button-page-previous"><ChevronLeft/> Trước</button><span>{page} / {Math.max(1,Math.ceil(data.total/data.limit))}</span><button onClick={()=>setPage(page+1)} disabled={page>=Math.ceil(data.total/data.limit)} data-testid="button-page-next">Tiếp <ChevronRight/></button></div></>:<div className="state-panel"><Search/><h2>Chưa tìm thấy hiện vật phù hợp</h2><p>Hãy thử một từ khóa khác hoặc mở rộng bộ lọc.</p><Button variant="outline" onClick={()=>{setQuery('');setPeriodId('');setMaterialId('')}} data-testid="button-reset-filters">Xóa bộ lọc</Button></div>}
  </main></PublicShell>;
}

function ArtifactDetailPage() {
  const {id=''}=useParams<{id:string}>();
  const {data,isLoading,isError,refetch}=useGetArtifact(id);
  const {ids,toggle,has}=useFavorites(); const [selected,setSelected]=useState(0); const [zoom,setZoom]=useState(false); const [activeHotspot,setActiveHotspot]=useState<Hotspot|null>(null);
  if(isLoading)return <PublicShell><Loading label="Đang đưa hiện vật đến gần hơn…"/></PublicShell>;
  if(isError||!data)return <PublicShell><Failure retry={()=>void refetch()}/></PublicShell>;
  const art=data as Artifact; const images=art.images?.length?art.images:[{id:'primary',imageUrl:art.imageUrl,alt:art.name,caption:'',isPrimary:true,sortOrder:0,hotspots:[]} as ArtifactImage]; const current=images[Math.min(selected,images.length-1)];
  return <PublicShell><main className="detail-wrap"><Link href="/collection" className="back-link" data-testid="link-back-collection"><ArrowLeft size={16}/> Trở về bộ sưu tập</Link><div className="detail-grid"><section className="artifact-viewer"><div className={`viewer-image ${zoom?'zoomed':''}`}><img src={imageServe(current.imageUrl)} alt={current.alt||art.name} onClick={()=>setZoom(!zoom)} data-testid="img-artifact-main"/>{current.hotspots?.map((spot,i)=><button key={spot.id} className="hotspot-dot" style={{left:`${spot.x}%`,top:`${spot.y}%`}} onClick={e=>{e.stopPropagation();setActiveHotspot(activeHotspot?.id===spot.id?null:spot)}} aria-label={`Chi tiết: ${spot.title}`} data-testid={`button-hotspot-${spot.id}`}>{i+1}</button>)}<button className="zoom-toggle" onClick={()=>setZoom(!zoom)} aria-label={zoom?'Thu nhỏ ảnh':'Phóng to ảnh'} data-testid="button-zoom-image">{zoom?<Minus/>:<ZoomIn/>}</button>{activeHotspot&&<div className="hotspot-popover"><button onClick={()=>setActiveHotspot(null)} aria-label="Đóng chi tiết"><X size={14}/></button><b>{activeHotspot.title}</b><p>{activeHotspot.body}</p></div>}</div><div className="viewer-caption"><span>{current.caption||current.alt||art.name}</span><span className="mono">{String(selected+1).padStart(2,'0')} / {String(images.length).padStart(2,'0')}</span></div>{images.length>1&&<div className="gallery-strip">{images.map((image,i)=><button key={image.id} className={selected===i?'selected':''} onClick={()=>{setSelected(i);setActiveHotspot(null)}} aria-label={`Xem ảnh ${i+1}`} data-testid={`button-gallery-${image.id}`}><img src={imageServe(image.imageUrl)} alt={image.alt||`Ảnh ${i+1}`}/></button>)}</div>}</section><section className="detail-copy"><span className="eyebrow">{art.periodName} <i>·</i> {art.materialName}</span><h1 className="editorial-title">{art.name}</h1><p className="detail-summary">{art.summary}</p><div className="detail-date"><Clock3 size={15}/>{art.dateLabel}</div><button onClick={()=>toggle(art.id)} className={`save-detail ${has(art.id)?'is-saved':''}`} data-testid="button-save-artifact"><Heart size={17} fill={has(art.id)?'currentColor':'none'}/>{has(art.id)?'Đã lưu vào danh sách của bạn':'Lưu hiện vật này'}</button><div className="detail-section"><span className="eyebrow">CÂU CHUYỆN</span><p>{art.history}</p></div><div className="detail-section"><span className="eyebrow">XUẤT XỨ</span><p>{art.origin}</p></div><div className="spec-grid"><div><small>THỜI KỲ</small><b>{art.periodName}</b></div><div><small>CHẤT LIỆU</small><b>{art.materialName}</b></div>{art.dimensions&&<div><small>KÍCH THƯỚC</small><b>{art.dimensions}</b></div>}{art.condition&&<div><small>TÌNH TRẠNG</small><b>{art.condition}</b></div>}</div><div className="viewer-tip"><ZoomIn size={15}/><span>Nhấn vào ảnh để phóng to. Chấm đánh dấu mở ra chi tiết đặc biệt.</span></div></section></div></main></PublicShell>;
}

function FavoritesPage() {
  const {ids,toggle,has}=useFavorites(); const {data,isLoading,isError,refetch}=useListArtifacts({limit:48});
  const saved=(data?.items||[]).filter(a=>ids.includes(a.id));
  return <PublicShell><main className="page-wrap"><PageIntro eyebrow="CHỈ BẠN MỚI THẤY · LƯU TRÊN THIẾT BỊ NÀY" title="Điều bạn mang theo" description="Những hiện vật bạn đánh dấu được lưu ngay trên thiết bị này, không cần tài khoản."/>
    {isLoading?<Loading/>:isError?<Failure retry={()=>void refetch()}/>:saved.length?<><div className="results-bar"><span>{saved.length} hiện vật đã lưu</span><button className="quiet-button" onClick={()=>{if(confirm('Bỏ lưu toàn bộ hiện vật trên thiết bị này?'))saved.forEach(a=>toggle(a.id))}} data-testid="button-clear-favorites">Bỏ lưu tất cả</button></div><div className="artifact-grid">{saved.map((a,i)=><ArtifactCard key={a.id} item={a} index={i} favorites={{ids,toggle,has}}/>)}</div></>:<div className="favorites-empty"><span className="empty-heart"><Heart/></span><span className="eyebrow">MỘT TRANG GIẤY CÒN TRỐNG</span><h2 className="editorial-title">Hãy để một điều<br/>ở lại với bạn.</h2><p>Nhấn biểu tượng trái tim bên cạnh hiện vật để lưu lại khám phá của mình.</p><Link className="button-primary" href="/collection">Bắt đầu dạo quanh <ArrowRight size={17}/></Link></div>}
  </main></PublicShell>;
}
function ExhibitionsPage() {
  const {data,isLoading,isError,refetch}=useListExhibitions();
  return <PublicShell><main className="page-wrap"><PageIntro eyebrow="NHỮNG CÂU CHUYỆN ĐƯỢC SẮP ĐẶT" title="Phòng trưng bày" description="Các lát cắt di sản được kết nối bằng một chủ đề, một câu hỏi, hay một mạch ký ức."/><div className="exhibitions-intro-band"><BookOpen/><p>Mỗi phòng là một hành trình được tuyển chọn. Hãy đi qua theo thứ tự, hoặc rẽ ngay đến điều đang gọi bạn.</p></div>{isLoading?<Loading/>:isError?<Failure retry={()=>void refetch()}/>:data?.length?<div className="exhibition-grid">{data.map((e,i)=><ExhibitionCard key={e.id} item={e} index={i}/>)}</div>:<div className="state-panel"><BookOpen/><h2>Phòng trưng bày đang được chuẩn bị</h2><p>Những hành trình mới sẽ sớm được mở cửa.</p></div>}</main></PublicShell>;
}
function ExhibitionDetailPage() {
  const {id=''}=useParams<{id:string}>(); const {data,isLoading,isError,refetch}=useGetExhibition(id);
  const {ids,toggle,has}=useFavorites();
  if(isLoading)return <PublicShell><Loading/></PublicShell>; if(isError||!data)return <PublicShell><Failure retry={()=>void refetch()}/></PublicShell>;
  const show=data as Exhibition;
  return <PublicShell><main className="detail-wrap"><Link href="/exhibitions" className="back-link"><ArrowLeft size={16}/> Tất cả phòng trưng bày</Link><section className="exhibition-detail-hero"><img src={imageServe(show.coverImage)} alt={show.title}/><div><span className="eyebrow">PHÒNG TRƯNG BÀY · {show.artifactCount} HIỆN VẬT</span><h1 className="editorial-title">{show.title}</h1><p>{show.summary}</p><div className="exhibition-dates">{show.startDate||'Lưu trữ thường trực'}{show.endDate?` — ${show.endDate}`:''}</div></div></section><section className="story-reading"><span className="eyebrow">CÂU CHUYỆN CỦA PHÒNG</span><p>{show.story}</p></section><section className="section-block"><div className="section-heading"><div><span className="eyebrow">CÁC HIỆN VẬT TRONG HÀNH TRÌNH</span><h2 className="editorial-title">Dừng chân tại đây</h2></div></div><div className="artifact-grid">{show.artifacts?.map((a,i)=><ArtifactCard key={a.id} item={a} index={i} favorites={{ids,toggle,has}}/>)}</div></section></main></PublicShell>;
}

function AdminGuard({children}:{children:(session: {id:string;email:string;displayName:string})=>React.ReactNode}) {
  const q=useGetAdminSession({query:{queryKey:getGetAdminSessionQueryKey(),retry:false}});
  const [authMode,setAuthMode]=useState<AuthMode|null>(null);
  if(q.isLoading)return <div className="admin-loading"><Loading label="Xác minh quyền quản trị…"/></div>;
  if(q.isError||!q.data)return <><div className="admin-denied"><div className="denied-icon"><LockKeyhole/></div><span className="eyebrow">KHU VỰC ĐƯỢC BẢO VỆ</span><h1 className="editorial-title">Đăng nhập để<br/>quản lý hiện vật.</h1><p>Tài khoản đã đăng ký được cấp quyền quản trị tự động. Đăng nhập hoặc tạo tài khoản để tiếp tục.</p><button className="button-primary" onClick={()=>setAuthMode('sign-in')} data-testid="button-admin-sign-in">Đăng nhập</button><Link href="/" className="button-outline">Quay về bảo tàng <ArrowLeft size={16}/></Link></div>{authMode&&<AuthDialog mode={authMode} onModeChange={setAuthMode} onAuthenticated={()=>{void q.refetch()}} onClose={()=>setAuthMode(null)}/>}</>;
  return <>{children(q.data)}</>;
}
const adminLinks=[['/admin','Tổng quan',LayoutDashboard],['/admin/artifacts','Hiện vật',Landmark],['/admin/exhibitions','Trưng bày',BookOpen],['/admin/content','Nội dung',Settings2],['/admin/accounts','Tài khoản',ShieldCheck]] as const;
function AdminShell({session,children}:{session:{displayName:string;email:string};children:React.ReactNode}) {
  const [location,setLocation]=useLocation(); const client=useQueryClient();const [error,setError]=useState('');
  const signOut=async()=>{setError('');try{const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw new Error('Không thể đăng xuất. Xin thử lại.');client.clear();setLocation('/')}catch(e){setError(e instanceof Error?e.message:'Không thể kết nối máy chủ xác thực.')}};
  return <div className="admin-app"><aside className="admin-sidebar"><BrandMark inverted/><div className="admin-label">KHÔNG GIAN QUẢN TRỊ</div><nav>{adminLinks.map(([href,label,Icon])=><Link key={href} href={href} className={location===href?'active':''} data-testid={`link-admin-${label}`}><Icon size={17}/>{label}</Link>)}</nav><div className="admin-account"><span className="admin-avatar">{session.displayName.slice(0,1).toUpperCase()}</span><span><b>{session.displayName}</b><small>{session.email}</small></span><button onClick={()=>void signOut()} aria-label="Đăng xuất" data-testid="button-admin-signout"><LogOut size={16}/></button></div><Link href="/" className="admin-back" data-testid="link-back-to-museum"><ArrowLeft size={15}/> Quay lại bảo tàng</Link></aside><main className="admin-main"><div className="admin-topbar"><span className="mono">BẢO TÀNG SỐ / QUẢN TRỊ</span><span className="admin-secure"><ShieldCheck size={15}/> Phiên quản trị an toàn</span></div>{error&&<div role="alert" className="auth-header-error">{error}</div>}{children}</main></div>;
}
function AdminFrame({children}:{children:(session:{id:string;email:string;displayName:string})=>React.ReactNode}) { return <AdminGuard>{session=><AdminShell session={session}>{children(session)}</AdminShell>}</AdminGuard>; }
function AdminDashboard() {
  const q=useGetAdminOverview(); const d=q.data;
  return <AdminFrame>{()=> <div className="admin-content"><div className="admin-page-heading"><div><span className="eyebrow">BẢNG ĐIỀU KHIỂN</span><h1 className="editorial-title">Chào mừng trở lại.</h1><p>Tình hình lưu trữ và cập nhật gần đây của bảo tàng.</p></div><Link href="/admin/artifacts" className="button-primary"><Plus size={17}/> Thêm hiện vật</Link></div>{q.isLoading?<Loading label="Đang tổng hợp kho lưu trữ…"/>:q.isError?<Failure retry={()=>void q.refetch()}/>:<><div className="stat-grid">{[['Tổng hiện vật',d?.artifactCount??0,Landmark],['Đã xuất bản',d?.publishedCount??0,Eye],['Bản nháp',d?.draftCount??0,Clock3],['Phòng trưng bày',d?.exhibitionCount??0,BookOpen],['Ảnh tư liệu',d?.imageCount??0,ImagePlus]].map(([label,value,Icon]:any)=><div className="stat-card" key={label}><span><Icon size={17}/>{label}</span><b>{value}</b><small>TRONG KHO HIỆN TẠI</small></div>)}</div><section className="admin-section"><div className="admin-section-head"><div><span className="eyebrow">DẤU VẾT MỚI NHẤT</span><h2 className="editorial-title">Hiện vật vừa cập nhật</h2></div><Link href="/admin/artifacts">Quản lý kho <ArrowRight size={15}/></Link></div><div className="admin-list">{d?.recentArtifacts?.map(a=><div className="admin-artifact-row" key={a.id}><img src={imageServe(a.imageUrl)} alt=""/><span><b>{a.name}</b><small>{a.periodName} · {a.dateLabel}</small></span>{a.isSample&&<SampleBadge/>}<span className={`status-pill ${a.status}`}>{a.status==='published'?'Đã xuất bản':'Bản nháp'}</span><Link href={`/artifacts/${a.slug||a.id}`} aria-label={`Xem ${a.name}`}><ArrowUpRight size={16}/></Link></div>)}</div></section></>}</div>}</AdminFrame>;
}
function ArtifactForm({artifact,onClose,onDone}:{artifact?:ArtifactSummary|null;onClose:()=>void;onDone:()=>void}) {
  const query=useQueryClient(); const create=useCreateArtifact(); const update=useUpdateArtifact(); const addImage=useAddArtifactImage(); const periods=useListPeriods(); const materials=useListMaterials();
  const detail=useGetAdminArtifact(artifact?.id||'',{query:{enabled:!!artifact?.id,queryKey:getGetAdminArtifactQueryKey(artifact?.id||'')}});
  const [fields,setFields]=useState({name:artifact?.name||'',slug:artifact?.slug||'',summary:artifact?.summary||'',history:'',origin:'',dateLabel:artifact?.dateLabel||'',periodId:'',materialId:'',status:artifact?.status||'published' as 'draft'|'published',dimensions:'',condition:''});
  const [imageFile,setImageFile]=useState<File|null>(null);const [imagePreview,setImagePreview]=useState('');const [formError,setFormError]=useState('');const [isSaving,setIsSaving]=useState(false);
  const dirty=useRef(false);
  useEffect(()=>{if(artifact){setFields(f=>({...f,periodId:artifact.periodName||'',materialId:artifact.materialName||''}))}},[artifact]);
  useEffect(()=>{if(detail.data&&!dirty.current){const a=detail.data as Artifact;setFields({name:a.name,slug:a.slug,summary:a.summary,history:a.history,origin:a.origin,dateLabel:a.dateLabel,periodId:a.periodId,materialId:a.materialId,status:a.status,dimensions:a.dimensions||'',condition:a.condition||''})}},[detail.data]);
  useEffect(()=>{if(!imageFile){setImagePreview('');return}const preview=URL.createObjectURL(imageFile);setImagePreview(preview);return()=>URL.revokeObjectURL(preview)},[imageFile]);
  const set=(key:string,value:string)=>{dirty.current=true;setFields(f=>({...f,[key]:value}))};
  const uploadImage=async(file:File)=>{const response=await fetch('/api/admin/uploads/image',{method:'POST',headers:{'Content-Type':file.type},body:file,credentials:'same-origin'});const payload=await response.json() as {imageUrl?:string;error?:string};if(!response.ok||!payload.imageUrl)throw new Error(payload.error||'Không thể tải ảnh lên.');return payload.imageUrl};
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setFormError('');if(!artifact&&!imageFile){setFormError('Vui lòng thêm ảnh hiện vật trước khi lưu.');return}if(periods.isError||materials.isError){setFormError('Không tải được danh sách thời kỳ hoặc chất liệu. Hãy thử tải lại trang.');return}setIsSaving(true);const period=periods.data?.find(p=>p.id===fields.periodId||p.name===fields.periodId);const material=materials.data?.find(m=>m.id===fields.materialId||m.name===fields.materialId);const periodId=period?.id||fields.periodId;const materialId=material?.id||fields.materialId;const slugFromTitle=fields.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'hien-vat';const payload={...fields,slug:fields.slug||`${slugFromTitle}-${Date.now().toString(36)}`,dateLabel:fields.dateLabel||period?.name||'Chưa xác định',periodId,materialId};try{if(artifact){await update.mutateAsync({id:artifact.id,data:payload});if(imageFile){const imageUrl=await uploadImage(imageFile);await addImage.mutateAsync({id:artifact.id,data:{imageUrl,alt:fields.name,caption:'',isPrimary:true}})}}else{const imageUrl=await uploadImage(imageFile!);await create.mutateAsync({data:{...payload,status:'published',imageUrl}})}await Promise.all([query.invalidateQueries({queryKey:getListAdminArtifactsQueryKey()}),query.invalidateQueries({queryKey:getGetAdminOverviewQueryKey()}),query.invalidateQueries({queryKey:getGetMuseumHomeQueryKey()}),query.invalidateQueries({queryKey:getListArtifactsQueryKey()}),query.invalidateQueries({queryKey:getListExhibitionsQueryKey()}),...(artifact?[query.invalidateQueries({queryKey:getGetArtifactQueryKey(artifact.id)}),query.invalidateQueries({queryKey:getGetAdminArtifactQueryKey(artifact.id)})]:[])]);onDone()}catch(error){setFormError(error instanceof Error?error.message:'Không thể lưu hiện vật. Xin thử lại.')}finally{setIsSaving(false)}};
  const displayedImage=imagePreview||(detail.data as Artifact|undefined)?.imageUrl||'';
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="edit-modal artifact-editor-modal" onSubmit={e=>void submit(e)}><div className="modal-head"><div><span className="eyebrow">{artifact?'CHỈNH SỬA HỒ SƠ':'HỒ SƠ HIỆN VẬT MỚI'}</span><h2 className="editorial-title">{artifact?'Cập nhật hiện vật':'Thêm hiện vật'}</h2></div><button type="button" onClick={onClose} aria-label="Đóng" data-testid="button-close-artifact-form"><X/></button></div><div className="artifact-form-layout"><div className="artifact-form-fields"><label className="artifact-title-field">Tiêu đề<Input required value={fields.name} onChange={e=>set('name',e.target.value)} data-testid="input-artifact-name" placeholder="Tên hiện vật"/></label><label>Chi tiết<Textarea required value={fields.summary} onChange={e=>set('summary',e.target.value)} data-testid="input-artifact-summary" placeholder="Mô tả ngắn hiện vật"/></label><label>Câu chuyện<Textarea required value={fields.history} onChange={e=>set('history',e.target.value)} data-testid="input-artifact-history"/></label><label>Xuất xứ<Input required value={fields.origin} onChange={e=>set('origin',e.target.value)} data-testid="input-artifact-origin"/></label><div className="form-grid"><label>Thời kỳ<select value={fields.periodId} onChange={e=>set('periodId',e.target.value)} required data-testid="select-artifact-period"><option value="">Chọn thời kỳ</option>{(periods.data||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Chất liệu<select value={fields.materialId} onChange={e=>set('materialId',e.target.value)} required data-testid="select-artifact-material"><option value="">Chọn chất liệu</option>{(materials.data||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Kích thước<Input value={fields.dimensions} onChange={e=>set('dimensions',e.target.value)} data-testid="input-artifact-dimensions"/></label><label>Tình trạng<Input value={fields.condition} onChange={e=>set('condition',e.target.value)} data-testid="input-artifact-condition"/></label></div>{artifact&&<label>Trạng thái<select value={fields.status} onChange={e=>set('status',e.target.value as 'draft'|'published')} data-testid="select-artifact-status"><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option></select></label>}</div><label className="artifact-image-upload"><span className="eyebrow">ẢNH HIỆN VẬT</span>{displayedImage?<img src={imageServe(displayedImage)} alt="Ảnh xem trước hiện vật"/>:<span className="image-upload-placeholder"><ImagePlus size={36}/><b>Thêm ảnh hiện vật</b><small>JPEG, PNG hoặc WebP · tối đa 10 MB</small></span>}<span className="upload-button"><Upload size={15}/>{imageFile?'Đổi ảnh':'Chọn ảnh'}<input type="file" accept="image/jpeg,image/png,image/webp" required={!artifact} onChange={e=>setImageFile(e.target.files?.[0]||null)} data-testid="input-artifact-primary-image"/></span>{artifact&&<small>Chọn ảnh mới để đặt làm ảnh chính</small>}</label></div>{artifact&&<MediaManager artifactId={artifact.id} />}{formError&&<p className="upload-error" role="alert">{formError}</p>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-artifact">Hủy</Button><Button type="submit" disabled={isSaving||create.isPending||update.isPending||addImage.isPending} data-testid="button-submit-artifact">{isSaving?'Đang lưu…':'Lưu và xuất bản'}</Button></div></form></div>;
}
function MediaManager({artifactId}:{artifactId:string}) {
  const client=useQueryClient();const artifact=useGetAdminArtifact(artifactId,{query:{queryKey:getGetAdminArtifactQueryKey(artifactId)}});const add=useAddArtifactImage();const updateImage=useUpdateArtifactImage();const deleteImage=useDeleteArtifactImage();const addHotspot=useAddImageHotspot();const updateHotspot=useUpdateImageHotspot();const deleteHotspot=useDeleteImageHotspot();
  const [selected,setSelected]=useState<string>('');const [annotation,setAnnotation]=useState<{x:number;y:number}|null>(null);const [selectedHotspot,setSelectedHotspot]=useState<Hotspot|null>(null);const [title,setTitle]=useState('');const [body,setBody]=useState('');const [uploadError,setUploadError]=useState('');const [isUploading,setIsUploading]=useState(false);
  const refresh=()=>{void client.invalidateQueries({queryKey:getGetAdminArtifactQueryKey(artifactId)});void client.invalidateQueries({queryKey:getListAdminArtifactsQueryKey()})};
  const a=artifact.data as Artifact|undefined;const images=a?.images||[];const current=images.find(i=>i.id===selected)||images[0];
  const upload=async(file:File)=>{setUploadError('');setIsUploading(true);try{const response=await fetch('/api/admin/uploads/image',{method:'POST',headers:{'Content-Type':file.type},body:file,credentials:'same-origin'});const payload=await response.json() as {imageUrl?:string;error?:string};if(!response.ok||!payload.imageUrl)throw new Error(payload.error||'Không thể tải ảnh lên.');await add.mutateAsync({id:artifactId,data:{imageUrl:payload.imageUrl,alt:file.name,caption:'',isPrimary:images.length===0}});refresh()}catch(error){setUploadError(error instanceof Error?error.message:'Không thể tải ảnh lên.');}finally{setIsUploading(false)}};
  const clickImage=(e:React.MouseEvent<HTMLDivElement>)=>{const rect=e.currentTarget.getBoundingClientRect();setAnnotation({x:Math.round((e.clientX-rect.left)*100/rect.width),y:Math.round((e.clientY-rect.top)*100/rect.height)})};
  return <section className="media-manager"><div className="media-head"><div><span className="eyebrow">TƯ LIỆU HÌNH ẢNH</span><b>Ảnh & điểm chú giải</b></div><label className="upload-button"><Upload size={14}/>{isUploading?'Đang tải…':'Tải ảnh lên'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={isUploading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}} data-testid="input-upload-artifact-image"/></label></div>{uploadError&&<p className="upload-error" role="alert">{uploadError}</p>}{artifact.isLoading?<div className="mini-loading">Đang tải tư liệu…</div>:images.length===0?<p className="mini-empty">Chưa có ảnh. Thêm ảnh để thiết lập chú giải tương tác.</p>:<><div className="media-image-stage" onClick={clickImage}><img src={imageServe(current?.imageUrl)} alt={current?.alt}/>{current?.hotspots?.map((spot,i)=><button type="button" key={spot.id} className="hotspot-dot" style={{left:`${spot.x}%`,top:`${spot.y}%`}} onClick={e=>{e.stopPropagation();setSelectedHotspot(spot);setAnnotation({x:spot.x,y:spot.y});setTitle(spot.title);setBody(spot.body)}} aria-label={`Sửa ${spot.title}`}>{i+1}</button>)}<span className="media-image-help">Nhấn lên ảnh để đặt điểm chú giải</span></div><div className="media-thumb-row">{images.map(img=><button type="button" key={img.id} className={current?.id===img.id?'selected':''} onClick={()=>{setSelected(img.id);setAnnotation(null);setSelectedHotspot(null)}}><img src={imageServe(img.imageUrl)} alt={img.alt}/></button>)}</div><div className="media-caption-row"><input value={current?.caption||''} placeholder="Chú thích ảnh" onChange={e=>current&&updateImage.mutate({id:current.id,data:{caption:e.target.value}},{onSuccess:refresh})} data-testid="input-image-caption"/><button type="button" onClick={()=>current&&updateImage.mutate({id:current.id,data:{isPrimary:true}},{onSuccess:refresh})} data-testid="button-set-primary-image">{current?.isPrimary?'Ảnh chính':'Đặt làm ảnh chính'}</button><button type="button" className="danger-action" onClick={()=>current&&confirm('Xóa ảnh và các điểm chú giải?')&&deleteImage.mutate({id:current.id},{onSuccess:refresh})} data-testid="button-delete-image">Xóa ảnh</button></div>{annotation&&<div className="hotspot-form"><span className="eyebrow">{selectedHotspot?'SỬA':'ĐIỂM'} {annotation.x}% · {annotation.y}%</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Tiêu đề chi tiết" data-testid="input-hotspot-title"/><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Giải thích điều cần chú ý…" data-testid="input-hotspot-body"/><button type="button" onClick={()=>current&&(selectedHotspot?updateHotspot.mutate({id:selectedHotspot.id,data:{title,body,x:annotation.x,y:annotation.y}},{onSuccess:()=>{refresh();setAnnotation(null);setSelectedHotspot(null)}}):addHotspot.mutate({id:current.id,data:{x:annotation.x,y:annotation.y,title,body}},{onSuccess:()=>{refresh();setAnnotation(null);setTitle('');setBody('')}}))} disabled={!title||!body} data-testid="button-save-hotspot">{selectedHotspot?'Cập nhật chú giải':'Lưu chú giải'}</button>{selectedHotspot&&<button type="button" className="danger-action" onClick={()=>deleteHotspot.mutate({id:selectedHotspot.id},{onSuccess:()=>{refresh();setAnnotation(null);setSelectedHotspot(null)}})} data-testid="button-delete-hotspot">Xóa điểm này</button>}</div>}</>}</section>;
}
function AdminArtifacts() {
  const [q,setQ]=useState(''); const [modal,setModal]=useState(false); const [editing,setEditing]=useState<ArtifactSummary|null>(null); const [page,setPage]=useState(1); const [deleteError,setDeleteError]=useState(''); const query=useQueryClient(); const list=useListAdminArtifacts({q:q||undefined,page,limit:30}); const remove=useDeleteArtifact();
  useEffect(()=>setPage(1),[q]);
  const startEdit=(a:ArtifactSummary)=>{setEditing(a);setModal(true)};
  const deleteArtifact=async(item:ArtifactSummary)=>{if(!confirm(`Xóa hồ sơ “${item.name}”?`))return;setDeleteError('');try{await remove.mutateAsync({id:item.id});await Promise.all([query.invalidateQueries({queryKey:getListAdminArtifactsQueryKey()}),query.invalidateQueries({queryKey:getGetAdminOverviewQueryKey()}),query.invalidateQueries({queryKey:getGetMuseumHomeQueryKey()}),query.invalidateQueries({queryKey:getListArtifactsQueryKey()}),query.invalidateQueries({queryKey:getListExhibitionsQueryKey()}),query.invalidateQueries({queryKey:getGetArtifactQueryKey(item.id)}),query.invalidateQueries({queryKey:getGetAdminArtifactQueryKey(item.id)})])}catch(error){setDeleteError(error instanceof Error?error.message:'Không thể xóa hiện vật. Xin thử lại.')}};
  return <AdminFrame>{()=> <div className="admin-content"><div className="admin-page-heading"><div><span className="eyebrow">KHO LƯU TRỮ</span><h1 className="editorial-title">Hiện vật</h1><p>Quản lý hồ sơ, trạng thái xuất bản và tư liệu hình ảnh.</p></div><Button onClick={()=>{setEditing(null);setModal(true)}} data-testid="button-new-artifact"><Plus size={16}/> Thêm hiện vật</Button></div>{deleteError&&<p className="upload-error" role="alert">{deleteError}</p>}<div className="admin-toolbar"><label className="search-box"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm trong hồ sơ…" data-testid="input-admin-artifact-search"/></label><span>{list.data?.total??0} hồ sơ</span></div>{list.isLoading?<Loading/>:list.isError?<Failure retry={()=>void list.refetch()}/>:list.data?.items.length?<><div className="admin-table"><div className="table-header"><span>HỒ SƠ</span><span>THỜI KỲ</span><span>TRẠNG THÁI</span><span>THAO TÁC</span></div>{list.data.items.map(a=><div className="table-row" key={a.id}><div className="table-title"><img src={imageServe(a.imageUrl)} alt=""/><span><b>{a.name}</b><small>{a.dateLabel}</small></span></div><span>{a.periodName}</span><span className={`status-pill ${a.status}`}>{a.status==='published'?'Đã xuất bản':'Bản nháp'}{a.isSample&&<SampleBadge/>}</span><div className="table-actions"><button onClick={()=>startEdit(a)} data-testid={`button-edit-artifact-${a.id}`}>Sửa</button><Link href={`/artifacts/${a.slug||a.id}`}>Xem</Link><button className="danger-action" onClick={()=>void deleteArtifact(a)} disabled={remove.isPending} data-testid={`button-delete-artifact-${a.id}`}>Xóa</button></div></div>)}</div><div className="pagination"><button disabled={page<=1} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page}</span><button disabled={(page*30)>=(list.data?.total||0)} onClick={()=>setPage(page+1)}>Trang sau</button></div></>:<div className="state-panel"><Landmark/><h2>Chưa có hồ sơ hiện vật</h2><p>Bắt đầu xây dựng bộ sưu tập số bằng cách thêm hồ sơ đầu tiên.</p><Button onClick={()=>{setEditing(null);setModal(true)}} data-testid="button-empty-add-artifact"><Plus/> Thêm hiện vật</Button></div>}{modal&&<ArtifactForm artifact={editing} onClose={()=>setModal(false)} onDone={()=>setModal(false)}/>}</div>}</AdminFrame>;
}
function AdminExhibitions() {
  return <AdminFrame>{() => <AdminExhibitionsManager />}</AdminFrame>;
}

function AdminContent() {
  const q=useGetMuseumIntro();const featured=useGetMuseumHome();const update=useUpdateMuseumIntro();const featureUpdate=useUpdateFeaturedArtifacts();const client=useQueryClient();
  const [f,setF]=useState({museumName:'',tagline:'',story:'',heroImage:''});const [selected,setSelected]=useState<string[]>([]);
  useEffect(()=>{if(q.data)setF({museumName:q.data.museumName,tagline:q.data.tagline,story:q.data.story,heroImage:q.data.heroImage||''})},[q.data]);useEffect(()=>{if(featured.data)setSelected(featured.data.featuredArtifacts.map(a=>a.id))},[featured.data]);
  const collection=useListAdminArtifacts({limit:100});
  return <AdminFrame>{()=> <div className="admin-content"><div className="admin-page-heading"><div><span className="eyebrow">TIẾNG NÓI CỦA BẢO TÀNG</span><h1 className="editorial-title">Nội dung</h1><p>Chỉnh sửa lời giới thiệu và những hiện vật nổi bật trên trang chủ.</p></div></div><section className="admin-edit-section"><div><span className="eyebrow">LỜI CHÀO</span><h2 className="editorial-title">Giới thiệu bảo tàng</h2></div>{q.isLoading?<Loading/>:<form className="content-form" onSubmit={e=>{e.preventDefault();update.mutate({data:f},{onSuccess:()=>{void client.invalidateQueries({queryKey:getGetMuseumIntroQueryKey()});void client.invalidateQueries({queryKey:getGetMuseumHomeQueryKey()})}})}}><label>Tên bảo tàng<Input value={f.museumName} onChange={e=>setF({...f,museumName:e.target.value})} required data-testid="input-museum-name"/></label><label>Câu dẫn<Input value={f.tagline} onChange={e=>setF({...f,tagline:e.target.value})} required data-testid="input-museum-tagline"/></label><label>Câu chuyện<textarea value={f.story} onChange={e=>setF({...f,story:e.target.value})} required data-testid="input-museum-story"/></label><label>Ảnh trang chủ<Input value={f.heroImage} onChange={e=>setF({...f,heroImage:e.target.value})} data-testid="input-museum-hero"/></label><Button type="submit" disabled={update.isPending} data-testid="button-save-intro">{update.isPending?'Đang lưu…':'Lưu lời giới thiệu'}</Button></form>}</section><section className="admin-edit-section"><div><span className="eyebrow">TRANG CHỦ</span><h2 className="editorial-title">Hiện vật nổi bật</h2><p>Chọn và sắp xếp các hồ sơ xuất hiện đầu tiên.</p></div>{collection.isLoading?<Loading/>:<div className="featured-chooser">{(collection.data?.items||[]).map(a=><label key={a.id} className="featured-option"><input type="checkbox" checked={selected.includes(a.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,a.id]:s.filter(id=>id!==a.id))} data-testid={`checkbox-featured-${a.id}`}/><img src={imageServe(a.imageUrl)} alt=""/><span>{a.name}</span></label>)}<Button onClick={()=>featureUpdate.mutate({data:{artifactIds:selected}},{onSuccess:()=>{void client.invalidateQueries({queryKey:getGetMuseumHomeQueryKey()})}})} disabled={featureUpdate.isPending} data-testid="button-save-featured">Lưu lựa chọn</Button></div>}</section></div>}</AdminFrame>;
}
function AdminAccounts() {
  const q=useListAdminAccounts();const grant=useInviteAdmin();const revoke=useRevokeAdmin();const client=useQueryClient();const [email,setEmail]=useState('');
  const [newAdmin,setNewAdmin]=useState({name:'',email:'',password:''});const [createError,setCreateError]=useState('');const [isCreating,setIsCreating]=useState(false);
  const createAdmin=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setCreateError('');setIsCreating(true);
    try{
      const response=await fetch('/api/admin/accounts/create',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(newAdmin)});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||'Không thể tạo tài khoản quản trị.');
      setNewAdmin({name:'',email:'',password:''});
      await client.invalidateQueries({queryKey:getListAdminAccountsQueryKey()});
    }catch(error){setCreateError(error instanceof Error?error.message:'Không thể kết nối máy chủ. Xin thử lại.')}
    finally{setIsCreating(false)}
  };
  return <AdminFrame>{()=> <div className="admin-content"><div className="admin-page-heading"><div><span className="eyebrow">QUYỀN VÀ TRÁCH NHIỆM</span><h1 className="editorial-title">Tài khoản quản trị</h1><p>Tạo tài khoản quản trị mới, cấp quyền cho tài khoản hiện có hoặc thu hồi quyền.</p></div></div><section className="admin-edit-section"><div><span className="eyebrow">TÀI KHOẢN MỚI</span><h2 className="editorial-title">Tạo tài khoản quản trị</h2><p>Tài khoản sẽ có quyền quản lý hiện vật và nội dung bảo tàng.</p></div><form className="create-admin-form" onSubmit={event=>void createAdmin(event)}><label>Họ và tên<Input required minLength={2} maxLength={80} autoComplete="name" value={newAdmin.name} onChange={event=>setNewAdmin({...newAdmin,name:event.target.value})} data-testid="input-new-admin-name"/></label><label>Email<Input type="email" required maxLength={254} autoComplete="email" value={newAdmin.email} onChange={event=>setNewAdmin({...newAdmin,email:event.target.value})} data-testid="input-new-admin-email"/></label><label>Mật khẩu<Input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={newAdmin.password} onChange={event=>setNewAdmin({...newAdmin,password:event.target.value})} data-testid="input-new-admin-password"/><small>Tối thiểu 8 ký tự.</small></label>{createError&&<p className="upload-error" role="alert">{createError}</p>}<Button type="submit" disabled={isCreating} data-testid="button-create-admin-account"><Plus size={16}/>{isCreating?'Đang tạo tài khoản…':'Tạo tài khoản quản trị'}</Button></form></section><form className="invite-form" onSubmit={e=>{e.preventDefault();grant.mutate({data:{email}},{onSuccess:()=>{setEmail('');void client.invalidateQueries({queryKey:getListAdminAccountsQueryKey()})}})}}><label>Email tài khoản đã đăng ký<Input type="email" required placeholder="ten@baotang.vn" value={email} onChange={e=>setEmail(e.target.value)} data-testid="input-invite-email"/></label><Button type="submit" disabled={grant.isPending} data-testid="button-invite-admin"><Plus size={16}/>{grant.isPending?'Đang cấp quyền…':'Cấp quyền quản trị'}</Button></form>{q.isLoading?<Loading/>:q.isError?<Failure retry={()=>void q.refetch()}/>:<div className="admin-table"><div className="table-header"><span>TÀI KHOẢN</span><span>TRẠNG THÁI</span><span>NGÀY THAM GIA</span><span>THAO TÁC</span></div>{(q.data||[]).map(a=><div className="table-row" key={a.id}><div className="table-title"><span className="admin-avatar">{a.email.slice(0,1).toUpperCase()}</span><span><b>{a.email}</b><small>Mã hồ sơ · {a.id.slice(0,8)}</small></span></div><span className={`status-pill ${a.status}`}>{a.status==='active'?'Quản trị viên':a.status==='invited'?'Đã mời':'Tài khoản thường'}</span><span>{new Date(a.createdAt).toLocaleDateString('vi-VN')}</span><div className="table-actions">{a.status==='active'&&<button className="danger-action" onClick={()=>{if(confirm(`Thu hồi quyền quản trị của ${a.email}?`))revoke.mutate({id:a.id},{onSuccess:()=>void client.invalidateQueries({queryKey:getListAdminAccountsQueryKey()})})}} data-testid={`button-revoke-admin-${a.id}`}>Thu hồi</button>}</div></div>)}</div>}</div>}</AdminFrame>;
}

function Router() {
  return <Switch><Route path="/" component={HomePage}/><Route path="/collection" component={CollectionPage}/><Route path="/artifacts/:id" component={ArtifactDetailPage}/><Route path="/exhibitions" component={ExhibitionsPage}/><Route path="/exhibitions/:id" component={ExhibitionDetailPage}/><Route path="/favorites" component={FavoritesPage}/><Route path="/admin" component={AdminDashboard}/><Route path="/admin/artifacts" component={AdminArtifacts}/><Route path="/admin/exhibitions" component={AdminExhibitions}/><Route path="/admin/content" component={AdminContent}/><Route path="/admin/accounts" component={AdminAccounts}/><Route component={NotFound}/></Switch>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;
