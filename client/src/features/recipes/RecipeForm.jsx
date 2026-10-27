import { useState } from 'react';
import { uploadImageToCloudinary } from '../../services/apiClient.js';

const blankIngredient = { displayName: '', quantity: '', unit: '', note: '' };
const blankStep = { instruction: '', durationMinutes: '' };

function initialValues(recipe) {
  return {
    title: recipe?.title || '', description: recipe?.description || '', coverImageId: recipe?.coverImageId || '',
    prepTimeMinutes: recipe?.prepTimeMinutes ?? '', cookTimeMinutes: recipe?.cookTimeMinutes ?? '',
    totalTimeMinutes: recipe?.totalTimeMinutes ?? '', servings: recipe?.servings ?? '',
    difficulty: recipe?.difficulty || 'EASY', visibility: recipe?.visibility || 'PRIVATE', categoryId: recipe?.categoryId || '', tagIds: recipe?.tags?.map((item) => item.tagId) || [],
    tips: recipe?.tips || '', substitutions: recipe?.substitutions || '', storageInstructions: recipe?.storageInstructions || '',
    ingredients: recipe?.ingredients?.length ? recipe.ingredients.map(({ displayName, quantity = '', unit = '', note = '' }) => ({ displayName, quantity, unit, note })) : [{ ...blankIngredient }],
    steps: recipe?.steps?.length ? recipe.steps.map(({ instruction, durationMinutes = '' }) => ({ instruction, durationMinutes })) : [{ ...blankStep }],
  };
}

function numberOrNull(value) { return value === '' ? null : Number(value); }

function buildPayload(values, visibility = values.visibility) {
  return {
    ...values,
    visibility,
    title: values.title.trim(),
    description: values.description.trim() || null,
    coverImageId: values.coverImageId.trim() || null,
    prepTimeMinutes: numberOrNull(values.prepTimeMinutes),
    cookTimeMinutes: numberOrNull(values.cookTimeMinutes),
    totalTimeMinutes: numberOrNull(values.totalTimeMinutes),
    servings: numberOrNull(values.servings),
    ingredients: values.ingredients.filter((item) => item.displayName.trim()).map((item) => ({ ...item, displayName: item.displayName.trim() })),
    steps: values.steps.filter((item) => item.instruction.trim()).map((item) => ({ ...item, instruction: item.instruction.trim(), durationMinutes: numberOrNull(item.durationMinutes) })),
  };
}

export function RecipeForm({ recipe, categories = [], tags = [], isSubmitting, serverError, onSubmit, accessToken }) {
  const [values, setValues] = useState(() => initialValues(recipe));
  const [errors, setErrors] = useState({});
  const [coverPreview, setCoverPreview] = useState(recipe?.coverImage?.secureUrl || '');
  const [coverState, setCoverState] = useState({ status: 'idle', error: null });
  const update = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const updateList = (field, index, key, value) => setValues((current) => ({ ...current, [field]: current[field].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const toggleTag = (tagId) => setValues((current) => ({
    ...current,
    tagIds: current.tagIds.includes(tagId) ? current.tagIds.filter((id) => id !== tagId) : [...current.tagIds, tagId],
  }));

  const uploadCover = async (file) => {
    if (!file) return;
    if (!accessToken) { setCoverState({ status: 'error', error: new Error('Hãy đăng nhập lại để upload ảnh.') }); return; }
    setCoverState({ status: 'uploading', error: null });
    const localPreview = URL.createObjectURL(file);
    setCoverPreview(localPreview);
    try {
      const uploaded = await uploadImageToCloudinary(file, accessToken, 'recipe');
      setValues((current) => ({ ...current, coverImageId: uploaded.mediaAssetId }));
      setCoverPreview(uploaded.secure_url);
      setCoverState({ status: 'success', error: null });
    } catch (error) {
      setCoverState({ status: 'error', error });
    } finally {
      URL.revokeObjectURL(localPreview);
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (values.title.trim().length < 3) nextErrors.title = 'Tiêu đề cần ít nhất 3 ký tự.';
    if (!values.ingredients.some((item) => item.displayName.trim())) nextErrors.ingredients = 'Cần ít nhất một nguyên liệu.';
    if (!values.steps.some((item) => item.instruction.trim())) nextErrors.steps = 'Cần ít nhất một bước thực hiện.';
    if (values.servings !== '' && Number(values.servings) <= 0) nextErrors.servings = 'Khẩu phần phải lớn hơn 0.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    onSubmit(buildPayload(values), false);
  };

  return (
    <form className="recipe-form" onSubmit={submit}>
      {serverError && <p className="form-error">{serverError.message}</p>}
      <label>Tiêu đề *<input value={values.title} onChange={(event) => update('title', event.target.value)} />{errors.title && <span className="field-error">{errors.title}</span>}</label>
      <label>Mô tả<textarea rows="3" value={values.description} onChange={(event) => update('description', event.target.value)} /></label>

      <fieldset className="cover-fieldset">
        <legend>Ảnh đại diện món ăn</legend>
        {coverPreview && <img className="cover-preview" src={coverPreview} alt="Xem trước ảnh đại diện công thức" />}
        <label>
          Upload ảnh JPG, PNG hoặc WEBP
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadCover(event.target.files?.[0])} />
        </label>
        {coverState.status === 'uploading' && <p className="field-hint" role="status">Đang upload ảnh...</p>}
        {coverState.error && <p className="field-error">{coverState.error.message}</p>}
        <label>
          Hoặc ID ảnh đã upload
          <input value={values.coverImageId} onChange={(event) => update('coverImageId', event.target.value)} placeholder="UUID từ media storage" />
        </label>
        <span className="field-hint">Cần ảnh đại diện trước khi gửi xuất bản. Ảnh phải thuộc tài khoản của bạn.</span>
      </fieldset>

      <div className="form-grid">
        <label>Chuẩn bị (phút)<input type="number" min="0" value={values.prepTimeMinutes} onChange={(event) => update('prepTimeMinutes', event.target.value)} /></label>
        <label>Nấu (phút)<input type="number" min="0" value={values.cookTimeMinutes} onChange={(event) => update('cookTimeMinutes', event.target.value)} /></label>
        <label>Tổng thời gian<input type="number" min="0" value={values.totalTimeMinutes} onChange={(event) => update('totalTimeMinutes', event.target.value)} /></label>
        <label>Khẩu phần<input type="number" min="1" value={values.servings} onChange={(event) => update('servings', event.target.value)} />{errors.servings && <span className="field-error">{errors.servings}</span>}</label>
      </div>
      <div className="form-grid">
        <label>Độ khó<select value={values.difficulty} onChange={(event) => update('difficulty', event.target.value)}><option value="EASY">Dễ</option><option value="MEDIUM">Trung bình</option><option value="HARD">Khó</option></select></label>
        <label>Hiển thị<select value={values.visibility} onChange={(event) => update('visibility', event.target.value)}><option value="PRIVATE">Riêng tư</option><option value="PUBLIC">Công khai</option><option value="UNLISTED">Không liệt kê</option></select></label>
        <label>Danh mục<select value={values.categoryId || ''} onChange={(event) => update('categoryId', event.target.value || null)}><option value="">Chọn danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>

      <fieldset>
        <legend>Tag</legend>
        <div className="tag-choices">
          {tags.length === 0 && <p className="field-hint">Chưa có tag nào.</p>}
          {tags.map((tag) => (
            <label className="filter-check" key={tag.id}>
              <input type="checkbox" checked={values.tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} /> {tag.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label>Mẹo nấu ăn<textarea rows="2" maxLength="3000" value={values.tips} onChange={(event) => update('tips', event.target.value)} /></label>
      <label>Gợi ý thay thế nguyên liệu<textarea rows="2" maxLength="3000" value={values.substitutions} onChange={(event) => update('substitutions', event.target.value)} /></label>
      <label>Hướng dẫn bảo quản<textarea rows="2" maxLength="2000" value={values.storageInstructions} onChange={(event) => update('storageInstructions', event.target.value)} /></label>

      <fieldset>
        <legend>Nguyên liệu</legend>
        {errors.ingredients && <p className="field-error">{errors.ingredients}</p>}
        {values.ingredients.map((item, index) => (
          <div className="dynamic-row" key={`ingredient-${index}`}>
            <input aria-label={`Tên nguyên liệu ${index + 1}`} placeholder="Tên nguyên liệu" value={item.displayName} onChange={(event) => updateList('ingredients', index, 'displayName', event.target.value)} />
            <input aria-label="Định lượng" placeholder="Số lượng" value={item.quantity} onChange={(event) => updateList('ingredients', index, 'quantity', event.target.value)} />
            <input aria-label="Đơn vị" placeholder="Đơn vị" value={item.unit} onChange={(event) => updateList('ingredients', index, 'unit', event.target.value)} />
            <button className="icon-button" type="button" aria-label="Xóa nguyên liệu" onClick={() => update('ingredients', values.ingredients.filter((_, itemIndex) => itemIndex !== index))}>×</button>
          </div>
        ))}
        <button className="text-button" type="button" onClick={() => update('ingredients', [...values.ingredients, { ...blankIngredient }])}>+ Thêm nguyên liệu</button>
      </fieldset>

      <fieldset>
        <legend>Các bước</legend>
        {errors.steps && <p className="field-error">{errors.steps}</p>}
        {values.steps.map((item, index) => (
          <div className="step-row" key={`step-${index}`}>
            <span>{index + 1}</span>
            <textarea aria-label={`Bước ${index + 1}`} placeholder="Mô tả cách thực hiện" rows="2" value={item.instruction} onChange={(event) => updateList('steps', index, 'instruction', event.target.value)} />
            <button className="icon-button" type="button" aria-label="Xóa bước" onClick={() => update('steps', values.steps.filter((_, itemIndex) => itemIndex !== index))}>×</button>
          </div>
        ))}
        <button className="text-button" type="button" onClick={() => update('steps', [...values.steps, { ...blankStep }])}>+ Thêm bước</button>
      </fieldset>

      <div className="form-actions">
        <button className="secondary-button" type="submit" disabled={isSubmitting}>Lưu bản nháp</button>
        <button className="primary-button" type="button" disabled={isSubmitting || coverState.status === 'uploading'} onClick={() => { if (validate()) onSubmit(buildPayload(values, 'PUBLIC'), true); }}>
          {isSubmitting ? 'Đang gửi...' : 'Lưu và gửi duyệt'}
        </button>
      </div>
    </form>
  );
}
