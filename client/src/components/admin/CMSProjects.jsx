import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '../../lib/api';
import MarkdownHelper from './MarkdownHelper';
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal';
import './CMSProjects.css';

// Zod Schema matching backend validation requirements
const ProjectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  details: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

/**
 * CMSProjects — Admin section for managing NGO Active Projects.
 * Implements full CRUD with a card-grid layout, inline editing, and ConfirmDeleteModal.
 */
export default function CMSProjects() {
  const queryClient = useQueryClient();
  const [editingProject, setEditingProject] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [apiError, setApiError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fetch Active Projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: async () => {
      const { data } = await adminApi.get('/projects');
      return data;
    },
  });

  // react-hook-form initialization
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ProjectSchema),
    defaultValues: {
      projectName: '',
      details: '',
      status: 'ACTIVE',
    },
  });

  // Mutation to save/update a project
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingProject) {
        return adminApi.put(`/projects/${editingProject.id}`, payload);
      }
      return adminApi.post('/projects', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      // Invalidate public cms content caches as well if they exist
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      closeForm();
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || err.message || 'Operation failed.');
    },
  });

  // Mutation to delete a project
  const deleteMutation = useMutation({
    mutationFn: async (id) => adminApi.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || 'Delete failed.');
      setDeleteTarget(null);
    },
  });

  const openForm = (project = null) => {
    setApiError('');
    if (project) {
      setEditingProject(project);

      reset({
        projectName: project.projectName,
        details: project.details || '',
        status: project.status,
      });
    } else {
      setEditingProject(null);
      reset({
        projectName: '',
        details: '',
        status: 'ACTIVE',
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProject(null);
    reset();
  };

  if (isLoading) return <div className="admin-loading">Loading projects...</div>;

  return (
    <div className="cms-section">
      <div className="cms-section__header">
        <h2>Active Projects Directory</h2>
        {!isFormOpen && (
          <button onClick={() => openForm()} className="cms-btn cms-btn--primary">
            + Add Project
          </button>
        )}
      </div>

      {apiError && <div className="cms-error-banner">{apiError}</div>}

      {isFormOpen ? (
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="cms-form glass animate-fade-in">
          <div className="workspace-container">
            <div className="fields-workspace">
              <h3>{editingProject ? `Edit Project: ${editingProject.projectName}` : 'Add Active Project'}</h3>

              <div className="cms-form__grid">
                <div className="cms-form__field">
                  <label>Project Name / Title</label>
                  <input {...register('projectName')} placeholder="e.g. Clean Water Initiative" />
                  {errors.projectName && <span className="field-error">{errors.projectName.message}</span>}
                </div>



                <div className="cms-form__field">
                  <label>Project Status</label>
                  <select {...register('status')}>
                    <option value="ACTIVE" style={{ color: '#000000', background: '#ffffff' }}>Active</option>
                    <option value="INACTIVE" style={{ color: '#000000', background: '#ffffff' }}>Inactive</option>
                  </select>
                  {errors.status && <span className="field-error">{errors.status.message}</span>}
                </div>

                <div className="cms-form__field cms-form__field--full">
                  <label>Project Details / Mission Description</label>
                  <textarea
                    rows={6}
                    {...register('details')}
                    placeholder="Provide detailed description of the project (Supports Markdown)..."
                  />
                  {errors.details && <span className="field-error">{errors.details.message}</span>}
                </div>
              </div>
            </div>

            <div className="sidebar-workspace">
              <MarkdownHelper />
            </div>
          </div>

          <div className="cms-form__actions">
            <button type="button" onClick={closeForm} className="cms-btn cms-btn--secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="cms-btn cms-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </form>
      ) : projects.length === 0 ? (
        <div className="cms-empty-state glass animate-fade-in">
          <div className="cms-empty-state__icon">📂</div>
          <h4>No Active Projects Yet</h4>
          <p>Create your first active project to highlight what initiatives your NGO is currently running.</p>
          <button onClick={() => openForm()} className="cms-btn cms-btn--primary">
            + Add First Project
          </button>
        </div>
      ) : (
        <div className="cms-cards-grid">
          {projects.map((project) => {
            return (
              <div
                key={project.id}
                className={`cms-card glass ${project.status === 'INACTIVE' ? 'cms-card--inactive' : ''}`}
              >
                <div className="cms-card__status-tag">
                  <span className={`status-dot status-dot--${project.status.toLowerCase()}`} />
                  {project.status}
                </div>
                <h4>{project.projectName}</h4>
                <p className="cms-card__description">
                  {project.details ? project.details.substring(0, 120) + (project.details.length > 120 ? '...' : '') : 'No details specified.'}
                </p>
                <div className="cms-card__actions">
                  <button onClick={() => openForm(project)} className="cms-btn-action">Edit</button>
                  <button
                    onClick={() => setDeleteTarget(project)}
                    className="cms-btn-action cms-btn-action--danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Active Project"
        message={deleteTarget ? `Are you sure you want to delete the project <strong>${deleteTarget.projectName}</strong>? This will also remove any votes and piggy banks associated with it.` : ''}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
