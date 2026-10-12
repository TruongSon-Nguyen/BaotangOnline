import { useState, type FormEvent } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Exhibition,
  useCreateExhibition,
  useDeleteExhibition,
  useListAdminArtifacts,
  useListAdminExhibitions,
  useUpdateExhibition,
  getListAdminExhibitionsQueryKey,
  getListExhibitionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import "./admin-exhibitions-manager.css";

type ExhibitionForm = {
  title: string;
  slug: string;
  summary: string;
  story: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  status: "draft" | "published";
};

const emptyForm: ExhibitionForm = {
  title: "",
  slug: "",
  summary: "",
  story: "",
  coverImage: "",
  startDate: "",
  endDate: "",
  status: "draft",
};

function imageSource(value: string | null | undefined) {
  if (!value) return "";
  return value.startsWith("/objects/") ? `/api/storage${value}` : value;
}

export default function AdminExhibitionsManager() {
  const query = useQueryClient();
  const { toast } = useToast();
  const exhibitions = useListAdminExhibitions();
  const artifacts = useListAdminArtifacts({ limit: 100 });
  const create = useCreateExhibition();
  const update = useUpdateExhibition();
  const remove = useDeleteExhibition();
  const [active, setActive] = useState<Exhibition | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExhibitionForm>(emptyForm);
  const [artifactIds, setArtifactIds] = useState<string[]>([]);

  const close = () => {
    setOpen(false);
    setActive(null);
    setForm(emptyForm);
    setArtifactIds([]);
  };

  const refresh = () => {
    void query.invalidateQueries({
      queryKey: getListAdminExhibitionsQueryKey(),
    });
    void query.invalidateQueries({ queryKey: getListExhibitionsQueryKey() });
  };

  const edit = (exhibition: Exhibition) => {
    setActive(exhibition);
    setForm({
      title: exhibition.title,
      slug: exhibition.slug,
      summary: exhibition.summary,
      story: exhibition.story,
      coverImage: exhibition.coverImage ?? "",
      startDate: exhibition.startDate ?? "",
      endDate: exhibition.endDate ?? "",
      status: exhibition.status,
    });
    setArtifactIds(exhibition.artifacts.map((artifact) => artifact.id));
    setOpen(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...form,
      coverImage: form.coverImage.trim() || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      artifactIds,
    };
    const onSuccess = () => {
      refresh();
      close();
      toast({ title: active ? "Phòng trưng bày đã được cập nhật" : "Đã tạo phòng trưng bày" });
    };
    const onError = () => {
      toast({
        title: "Không thể lưu phòng trưng bày",
        description: "Kiểm tra lại đường dẫn, ngày tháng và hồ sơ đã chọn.",
        variant: "destructive",
      });
    };
    if (active) {
      update.mutate({ id: active.id, data: payload }, { onSuccess, onError });
    } else {
      create.mutate({ data: payload }, { onSuccess, onError });
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">BIÊN TẬP THEO CHỦ ĐỀ</span>
          <h1 className="editorial-title">Phòng trưng bày</h1>
          <p>Kết nối hiện vật thành những hành trình có chủ đích.</p>
        </div>
        <Button
          onClick={() => {
            close();
            setOpen(true);
          }}
          data-testid="button-new-exhibition"
        >
          <Plus size={16} /> Tạo phòng trưng bày
        </Button>
      </div>

      {exhibitions.isLoading ? (
        <div className="mini-loading">Đang tải phòng trưng bày…</div>
      ) : exhibitions.isError ? (
        <div className="state-panel">
          <BookOpen />
          <h2>Không thể tải danh sách</h2>
          <Button variant="outline" onClick={() => void exhibitions.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : exhibitions.data?.length ? (
        <div className="admin-table">
          <div className="table-header">
            <span>PHÒNG TRƯNG BÀY</span>
            <span>HIỆN VẬT</span>
            <span>TRẠNG THÁI</span>
            <span>THAO TÁC</span>
          </div>
          {exhibitions.data.map((exhibition) => (
            <div className="table-row" key={exhibition.id}>
              <div className="table-title">
                {exhibition.coverImage ? (
                  <img src={imageSource(exhibition.coverImage)} alt="" />
                ) : (
                  <span className="admin-avatar">
                    <BookOpen size={17} />
                  </span>
                )}
                <span>
                  <b>{exhibition.title}</b>
                  <small>{exhibition.slug}</small>
                </span>
              </div>
              <span>{exhibition.artifactCount}</span>
              <span className={`status-pill ${exhibition.status}`}>
                {exhibition.status === "published" ? "Đã xuất bản" : "Bản nháp"}
              </span>
              <div className="table-actions">
                <button
                  onClick={() => edit(exhibition)}
                  data-testid={`button-edit-exhibition-${exhibition.id}`}
                >
                  Sửa
                </button>
                <button
                  className="danger-action"
                  onClick={() => {
                    if (!confirm(`Xóa phòng trưng bày “${exhibition.title}”?`)) return;
                    remove.mutate(
                      { id: exhibition.id },
                      {
                        onSuccess: refresh,
                        onError: () =>
                          toast({
                            title: "Không thể xóa phòng trưng bày",
                            variant: "destructive",
                          }),
                      },
                    );
                  }}
                  data-testid={`button-delete-exhibition-${exhibition.id}`}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="state-panel">
          <BookOpen />
          <h2>Chưa có phòng trưng bày</h2>
          <p>Tạo một chủ đề và chọn những hiện vật khách tham quan sẽ khám phá.</p>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Tạo phòng trưng bày
          </Button>
        </div>
      )}

      {open && (
        <div className="modal-backdrop" role="presentation">
          <form className="edit-modal" onSubmit={submit}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">BIÊN TẬP HÀNH TRÌNH</span>
                <h2 className="editorial-title">
                  {active ? "Cập nhật phòng" : "Phòng trưng bày mới"}
                </h2>
              </div>
              <button type="button" onClick={close} aria-label="Đóng">
                <X />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Tên phòng
                <Input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  data-testid="input-exhibition-title"
                />
              </label>
              <label>
                Đường dẫn
                <Input
                  required
                  value={form.slug}
                  onChange={(event) =>
                    setForm({ ...form, slug: event.target.value })
                  }
                  data-testid="input-exhibition-slug"
                />
              </label>
              <label className="span-2">
                Tóm tắt
                <Textarea
                  required
                  value={form.summary}
                  onChange={(event) =>
                    setForm({ ...form, summary: event.target.value })
                  }
                  data-testid="input-exhibition-summary"
                />
              </label>
              <label className="span-2">
                Câu chuyện
                <Textarea
                  required
                  value={form.story}
                  onChange={(event) =>
                    setForm({ ...form, story: event.target.value })
                  }
                  data-testid="input-exhibition-story"
                />
              </label>
              <label className="span-2">
                Ảnh bìa (URL hoặc đường dẫn lưu trữ)
                <Input
                  value={form.coverImage}
                  onChange={(event) =>
                    setForm({ ...form, coverImage: event.target.value })
                  }
                  data-testid="input-exhibition-cover"
                />
              </label>
              <label>
                Ngày mở
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm({ ...form, startDate: event.target.value })
                  }
                />
              </label>
              <label>
                Ngày kết thúc
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm({ ...form, endDate: event.target.value })
                  }
                />
              </label>
              <label>
                Trạng thái
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as "draft" | "published",
                    })
                  }
                >
                  <option value="draft">Bản nháp</option>
                  <option value="published">Đã xuất bản</option>
                </select>
              </label>
            </div>
            <fieldset className="exhibition-artifact-picker">
              <legend>Hiện vật trong phòng trưng bày</legend>
              {artifacts.isLoading ? (
                <p>Đang tải hiện vật…</p>
              ) : (
                artifacts.data?.items.map((artifact) => (
                  <label key={artifact.id}>
                    <input
                      type="checkbox"
                      checked={artifactIds.includes(artifact.id)}
                      onChange={(event) =>
                        setArtifactIds((current) =>
                          event.target.checked
                            ? [...current, artifact.id]
                            : current.filter((id) => id !== artifact.id),
                        )
                      }
                    />
                    <span>{artifact.name}</span>
                    <small>{artifact.status === "published" ? "Đã xuất bản" : "Bản nháp"}</small>
                  </label>
                ))
              )}
            </fieldset>
            <div className="modal-actions">
              <Button type="button" variant="outline" onClick={close}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={create.isPending || update.isPending || artifacts.isLoading}
                data-testid="button-save-exhibition"
              >
                {create.isPending || update.isPending ? "Đang lưu…" : "Lưu phòng"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
