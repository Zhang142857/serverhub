<template>
  <div class="files-page">
    <div class="page-header">
      <div class="header-left">
        <h1>文件管理</h1>
        <el-select v-model="selectedServer" placeholder="选择服务器" class="server-select">
          <el-option
            v-for="server in connectedServers"
            :key="server.id"
            :label="server.name"
            :value="server.id"
          />
        </el-select>
      </div>
      <div class="header-right">
        <!-- 最近访问历史 -->
        <el-popover placement="bottom" :width="350" trigger="click" v-model:visible="showHistoryPanel">
          <template #reference>
            <el-button>
              <el-icon><Clock /></el-icon>
              历史
              <el-badge v-if="recentHistory.length > 0" :value="recentHistory.length" :max="99" class="history-badge" />
            </el-button>
          </template>
          <div class="history-popover">
            <div class="history-header">
              <span>最近访问</span>
              <el-button text size="small" @click="clearHistory" :disabled="recentHistory.length === 0">
                清空
              </el-button>
            </div>
            <div class="history-list">
              <div
                v-for="(item, index) in recentHistory"
                :key="index"
                class="history-item"
                @click="navigateToHistoryItem(item)"
              >
                <el-icon :color="item.isDir ? '#f0b429' : '#6b7280'">
                  <Folder v-if="item.isDir" />
                  <Document v-else />
                </el-icon>
                <div class="history-info">
                  <span class="history-name">{{ item.name }}</span>
                  <span class="history-path">{{ item.path }}</span>
                </div>
                <span class="history-time">{{ formatRelativeTime(item.accessTime) }}</span>
              </div>
              <div v-if="recentHistory.length === 0" class="no-history">
                暂无访问记录
              </div>
            </div>
          </div>
        </el-popover>

        <el-popover placement="bottom" :width="300" trigger="click">
          <template #reference>
            <el-button>
              <el-icon><Star /></el-icon>
              收藏夹
            </el-button>
          </template>
          <div class="bookmarks-popover">
            <div class="bookmarks-header">
              <span>收藏的路径</span>
              <el-button text size="small" @click="addBookmark" :disabled="!currentPath">
                <el-icon><Plus /></el-icon>
                添加当前
              </el-button>
            </div>
            <div class="bookmarks-list">
              <div
                v-for="(bookmark, index) in bookmarks"
                :key="index"
                class="bookmark-item"
                @click="navigateToBookmark(bookmark)"
              >
                <el-icon><Folder /></el-icon>
                <span class="bookmark-path">{{ bookmark.name || bookmark.path }}</span>
                <el-button
                  text
                  size="small"
                  class="bookmark-delete"
                  @click.stop="removeBookmark(index)"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              <div v-if="bookmarks.length === 0" class="no-bookmarks">
                暂无收藏
              </div>
            </div>
          </div>
        </el-popover>
        <el-input
          v-model="searchQuery"
          :placeholder="contentSearchMode ? '搜索文件内容...' : '搜索文件名...'"
          class="search-input"
          clearable
          @keyup.enter="searchFiles"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #append>
            <el-tooltip :content="contentSearchMode ? '内容搜索' : '名称搜索'" placement="top">
              <el-button @click="contentSearchMode = !contentSearchMode" :type="contentSearchMode ? 'primary' : ''">
                <el-icon><Switch /></el-icon>
              </el-button>
            </el-tooltip>
            <el-checkbox v-model="recursiveSearch" label="递归" size="small" />
          </template>
        </el-input>
      </div>
    </div>

    <!-- 路径导航和操作栏 -->
    <div class="toolbar" v-if="selectedServer">
      <div class="path-nav">
        <el-button @click="goUp" :disabled="currentPath === ''" size="small">
          <el-icon><Top /></el-icon>
        </el-button>
        <el-button @click="refresh" size="small" :loading="loading">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button @click="goHome" size="small" title="主目录">
          <el-icon><House /></el-icon>
        </el-button>
        <div class="breadcrumb-wrapper">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item @click="navigateToRoot" class="clickable">
              <el-icon><HomeFilled /></el-icon>
            </el-breadcrumb-item>
            <el-breadcrumb-item
              v-for="(part, index) in pathParts"
              :key="index"
              @click="navigateTo(index)"
              class="clickable"
            >
              {{ part }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <el-input
          v-model="directPathInput"
          placeholder="直接输入路径..."
          class="direct-path-input"
          size="small"
          @keyup.enter="navigateToDirectPath"
        >
          <template #prefix>
            <el-icon><Position /></el-icon>
          </template>
        </el-input>
      </div>
      <div class="actions">
        <!-- 剪贴板状态 -->
        <div v-if="clipboard.files.length > 0" class="clipboard-status">
          <el-tag :type="clipboard.mode === 'cut' ? 'warning' : 'info'" size="small">
            {{ clipboard.mode === 'cut' ? '剪切' : '复制' }}: {{ clipboard.files.length }} 个文件
          </el-tag>
          <el-button size="small" @click="pasteFiles" type="primary">
            <el-icon><DocumentCopy /></el-icon>
            粘贴
          </el-button>
          <el-button size="small" @click="clearClipboard">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <el-button-group>
          <el-button size="small" @click="showNewFolderDialog = true">
            <el-icon><FolderAdd /></el-icon>
            新建文件夹
          </el-button>
          <el-button size="small" @click="showNewFileDialog = true">
            <el-icon><DocumentAdd /></el-icon>
            新建文件
          </el-button>
          <el-button size="small" @click="showUploadDialog = true">
            <el-icon><Upload /></el-icon>
            上传
          </el-button>
        </el-button-group>
        <el-button-group v-if="selectedFiles.length > 0">
          <el-button size="small" @click="copyToClipboard">
            <el-icon><CopyDocument /></el-icon>
            复制
          </el-button>
          <el-button size="small" @click="cutToClipboard">
            <el-icon><Scissor /></el-icon>
            剪切
          </el-button>
          <el-button size="small" @click="downloadSelected">
            <el-icon><Download /></el-icon>
            下载 ({{ selectedFiles.length }})
          </el-button>
          <el-button size="small" @click="compressSelected">
            <el-icon><Files /></el-icon>
            压缩
          </el-button>
          <el-button
            v-if="selectedFiles.length === 2 && !selectedFiles[0].isDir && !selectedFiles[1].isDir"
            size="small"
            @click="compareSelectedFiles"
          >
            <el-icon><Switch /></el-icon>
            比较
          </el-button>
          <el-button size="small" type="danger" @click="deleteSelected">
            <el-icon><Delete /></el-icon>
            删除 ({{ selectedFiles.length }})
          </el-button>
        </el-button-group>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="list"><el-icon><List /></el-icon></el-radio-button>
          <el-radio-button value="grid"><el-icon><Grid /></el-icon></el-radio-button>
        </el-radio-group>
        <el-button size="small" @click="showInfoPanel = !showInfoPanel" :type="showInfoPanel ? 'primary' : ''">
          <el-icon><InfoFilled /></el-icon>
        </el-button>
      </div>
    </div>

    <div v-if="!selectedServer" class="empty-state">
      <el-empty description="请先选择一个已连接的服务器" />
    </div>

    <template v-else>
      <div class="main-content" :class="{ 'with-info-panel': showInfoPanel }">
        <div class="file-list-area">
          <!-- 列表视图 -->
          <el-table
            v-if="viewMode === 'list'"
            :data="filteredFiles"
            v-loading="loading"
            @row-dblclick="handleDoubleClick"
            @selection-change="handleSelectionChange"
            @row-contextmenu="handleContextMenu"
            class="file-table"
            row-key="path"
          >
            <el-table-column type="selection" width="40" />
            <el-table-column width="40">
              <template #default="{ row }">
                <el-icon :size="20" :color="getFileIconColor(row)">
                  <Folder v-if="row.isDir" />
                  <Picture v-else-if="isImageFile(row.name)" />
                  <VideoCamera v-else-if="isVideoFile(row.name)" />
                  <Headset v-else-if="isAudioFile(row.name)" />
                  <Document v-else />
                </el-icon>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" min-width="250" sortable>
              <template #default="{ row }">
                <span class="file-name" @click.stop="handleDoubleClick(row)">{{ row.name }}</span>
                <el-tag v-if="isClipboardFile(row)" size="small" :type="clipboard.mode === 'cut' ? 'warning' : 'info'" class="clipboard-tag">
                  {{ clipboard.mode === 'cut' ? '剪切' : '复制' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="大小" width="100" sortable :sort-method="sortBySize">
              <template #default="{ row }">
                {{ row.isDir ? '-' : formatSize(row.size) }}
              </template>
            </el-table-column>
            <el-table-column label="修改时间" width="170" sortable>
              <template #default="{ row }">
                {{ formatTime(row.modTime) }}
              </template>
            </el-table-column>
            <el-table-column label="权限" width="80">
              <template #default="{ row }">
                <span class="permission">{{ formatMode(row.mode) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text @click.stop="viewFile(row)" v-if="!row.isDir">
                  <el-icon><View /></el-icon>
                </el-button>
                <el-button size="small" text @click.stop="previewImage(row)" v-if="isImageFile(row.name)">
                  <el-icon><ZoomIn /></el-icon>
                </el-button>
                <el-button size="small" text @click.stop="downloadFile(row)" v-if="!row.isDir">
                  <el-icon><Download /></el-icon>
                </el-button>
                <el-dropdown trigger="click" @command="handleFileAction($event, row)">
                  <el-button size="small" text @click.stop>
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="copy">
                        <el-icon><CopyDocument /></el-icon> 复制
                      </el-dropdown-item>
                      <el-dropdown-item command="cut">
                        <el-icon><Scissor /></el-icon> 剪切
                      </el-dropdown-item>
                      <el-dropdown-item command="rename">
                        <el-icon><EditPen /></el-icon> 重命名
                      </el-dropdown-item>
                      <el-dropdown-item command="move">
                        <el-icon><Rank /></el-icon> 移动到
                      </el-dropdown-item>
                      <el-dropdown-item command="chmod">
                        <el-icon><Lock /></el-icon> 修改权限
                      </el-dropdown-item>
                      <el-dropdown-item v-if="isArchiveFile(row.name)" command="extract">
                        <el-icon><FolderOpened /></el-icon> 解压
                      </el-dropdown-item>
                      <el-dropdown-item v-if="!row.isDir" command="compress">
                        <el-icon><Files /></el-icon> 压缩
                      </el-dropdown-item>
                      <el-dropdown-item command="delete" divided>
                        <span class="danger-text"><el-icon><Delete /></el-icon> 删除</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>

          <!-- 网格视图 -->
          <div v-else class="grid-view" v-loading="loading" @contextmenu.prevent="handleEmptyContextMenu">
            <div
              v-for="file in filteredFiles"
              :key="file.path"
              class="grid-item"
              :class="{ selected: selectedFiles.includes(file), 'clipboard-item': isClipboardFile(file) }"
              @click="toggleFileSelection(file)"
              @dblclick="handleDoubleClick(file)"
              @contextmenu.prevent.stop="handleContextMenu(file, $event)"
            >
              <div class="grid-icon">
                <el-icon :size="48" :color="getFileIconColor(file)">
                  <Folder v-if="file.isDir" />
                  <Picture v-else-if="isImageFile(file.name)" />
                  <VideoCamera v-else-if="isVideoFile(file.name)" />
                  <Headset v-else-if="isAudioFile(file.name)" />
                  <Document v-else />
                </el-icon>
              </div>
              <div class="grid-name" :title="file.name">{{ file.name }}</div>
              <div class="grid-info">{{ file.isDir ? '文件夹' : formatSize(file.size) }}</div>
            </div>
            <div v-if="filteredFiles.length === 0" class="empty-folder">
              <el-empty description="文件夹为空" />
            </div>
          </div>
        </div>

        <!-- 文件信息面板 -->
        <div v-if="showInfoPanel" class="info-panel">
          <div class="info-panel-header">
            <h3>文件信息</h3>
            <el-button text size="small" @click="showInfoPanel = false">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <div v-if="selectedFiles.length === 0" class="info-panel-empty">
            <el-icon :size="48"><Document /></el-icon>
            <p>选择文件查看详情</p>
          </div>
          <div v-else-if="selectedFiles.length === 1" class="info-panel-content">
            <div class="info-preview">
              <el-icon :size="64" :color="getFileIconColor(selectedFiles[0])">
                <Folder v-if="selectedFiles[0].isDir" />
                <Picture v-else-if="isImageFile(selectedFiles[0].name)" />
                <VideoCamera v-else-if="isVideoFile(selectedFiles[0].name)" />
                <Document v-else />
              </el-icon>
            </div>
            <div class="info-name">{{ selectedFiles[0].name }}</div>
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="类型">
                {{ selectedFiles[0].isDir ? '文件夹' : getFileType(selectedFiles[0].name) }}
              </el-descriptions-item>
              <el-descriptions-item label="大小">
                {{ selectedFiles[0].isDir ? '-' : formatSize(selectedFiles[0].size) }}
              </el-descriptions-item>
              <el-descriptions-item label="路径">
                <span class="info-path">{{ selectedFiles[0].path }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="权限">
                {{ formatMode(selectedFiles[0].mode) }}
              </el-descriptions-item>
              <el-descriptions-item label="修改时间">
                {{ formatTime(selectedFiles[0].modTime) }}
              </el-descriptions-item>
            </el-descriptions>
            <div class="info-actions">
              <el-button size="small" @click="viewFile(selectedFiles[0])" v-if="!selectedFiles[0].isDir">
                <el-icon><View /></el-icon> 查看
              </el-button>
              <el-button size="small" @click="downloadFile(selectedFiles[0])" v-if="!selectedFiles[0].isDir">
                <el-icon><Download /></el-icon> 下载
              </el-button>
            </div>
          </div>
          <div v-else class="info-panel-multi">
            <div class="multi-icon">
              <el-icon :size="48"><Files /></el-icon>
            </div>
            <div class="multi-count">已选择 {{ selectedFiles.length }} 个项目</div>
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="文件夹">
                {{ selectedFiles.filter(f => f.isDir).length }} 个
              </el-descriptions-item>
              <el-descriptions-item label="文件">
                {{ selectedFiles.filter(f => !f.isDir).length }} 个
              </el-descriptions-item>
              <el-descriptions-item label="总大小">
                {{ formatSize(selectedFiles.reduce((sum, f) => sum + (f.isDir ? 0 : f.size), 0)) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </div>
    </template>

    <!-- 文件查看/编辑对话框 -->
    <el-dialog
      v-model="showFileDialog"
      :title="currentFile?.name"
      width="80%"
      top="5vh"
    >
      <div class="file-toolbar">
        <div class="file-toolbar-left">
          <span class="file-path">{{ currentFile?.path }}</span>
          <el-tag size="small" type="info">{{ getFileLanguage(currentFile?.name || '') }}</el-tag>
        </div>
        <div class="file-toolbar-right">
          <span class="file-size">{{ formatSize(currentFile?.size || 0) }}</span>
          <el-button-group size="small">
            <el-button @click="copyFileContent" title="复制内容">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
            <el-button @click="downloadFile(currentFile!)" v-if="currentFile" title="下载">
              <el-icon><Download /></el-icon>
            </el-button>
          </el-button-group>
        </div>
      </div>
      <div class="file-editor" :class="{ 'editing-mode': editing }">
        <div v-if="!editing" class="code-viewer">
          <div class="line-numbers">
            <span v-for="n in fileContentLines" :key="n">{{ n }}</span>
          </div>
          <pre class="code-content" :class="'language-' + getFileLanguage(currentFile?.name || '')"><code>{{ fileContent }}</code></pre>
        </div>
        <el-input
          v-else
          v-model="fileContent"
          type="textarea"
          :rows="25"
        />
      </div>
      <template #footer>
        <el-button v-if="!editing" @click="editing = true">
          <el-icon><Edit /></el-icon> 编辑
        </el-button>
        <el-button v-if="editing" @click="saveFile" type="primary">
          <el-icon><Check /></el-icon> 保存
        </el-button>
        <el-button @click="showFileDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新建文件夹对话框 -->
    <el-dialog v-model="showNewFolderDialog" title="新建文件夹" width="400px">
      <el-form>
        <el-form-item label="文件夹名称">
          <el-input v-model="newFolderName" placeholder="输入文件夹名称" @keyup.enter="createFolder" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewFolderDialog = false">取消</el-button>
        <el-button type="primary" @click="createFolder">创建</el-button>
      </template>
    </el-dialog>

    <!-- 新建文件对话框 -->
    <el-dialog v-model="showNewFileDialog" title="新建文件" width="400px">
      <el-form>
        <el-form-item label="文件名称">
          <el-input v-model="newFileName" placeholder="输入文件名称" @keyup.enter="createFile" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewFileDialog = false">取消</el-button>
        <el-button type="primary" @click="createFile">创建</el-button>
      </template>
    </el-dialog>

    <!-- 上传对话框 -->
    <el-dialog v-model="showUploadDialog" title="上传" width="600px">
      <el-tabs v-model="uploadTab">
        <el-tab-pane label="上传文件" name="files">
          <el-upload
            class="upload-area"
            drag
            multiple
            :auto-upload="false"
            :file-list="uploadFileList"
            @change="handleUploadChange"
          >
            <el-icon class="el-icon--upload"><Upload /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此处，或 <em>点击选择</em>
            </div>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="上传文件夹" name="folder">
          <div class="folder-upload-section">
            <!-- 选择本地文件夹 -->
            <div class="upload-step">
              <div class="step-label">
                <span class="step-number">1</span>
                <span>选择本地文件夹</span>
              </div>
              <div class="folder-select-area" @click="selectLocalFolder">
                <template v-if="!selectedFolderPath">
                  <el-icon class="folder-icon"><FolderOpened /></el-icon>
                  <div class="folder-text">点击选择本地文件夹</div>
                </template>
                <template v-else>
                  <el-icon><Folder /></el-icon>
                  <span class="selected-folder-name">{{ selectedFolderName }}</span>
                  <el-tag size="small" type="info">{{ folderFiles.length }} 个文件</el-tag>
                  <el-button text type="primary" size="small" @click.stop="selectLocalFolder">重新选择</el-button>
                </template>
              </div>
            </div>

            <!-- 文件预览 -->
            <div class="folder-preview" v-if="folderFiles.length > 0">
              <div class="preview-header">
                <span>文件预览</span>
                <span class="file-count">共 {{ folderFiles.length }} 个文件</span>
              </div>
              <div class="preview-list">
                <div v-for="file in folderFiles.slice(0, 6)" :key="file.path" class="preview-item">
                  <el-icon v-if="file.isDir" color="#f0b429"><Folder /></el-icon>
                  <el-icon v-else color="#6b7280"><Document /></el-icon>
                  <span class="file-name">{{ file.path }}</span>
                  <span class="file-size" v-if="!file.isDir">{{ formatSize(file.size) }}</span>
                </div>
                <div v-if="folderFiles.length > 6" class="preview-more">
                  ... 还有 {{ folderFiles.length - 6 }} 个文件
                </div>
              </div>
            </div>

            <!-- 选择上传目标位置 -->
            <div class="upload-step">
              <div class="step-label">
                <span class="step-number">2</span>
                <span>选择上传位置</span>
              </div>
              <div class="target-path-section">
                <div class="quick-paths">
                  <span class="quick-label">快捷路径:</span>
                  <el-tag 
                    v-for="path in quickUploadPaths" 
                    :key="path.path"
                    :type="uploadTargetPath === path.path ? 'primary' : 'info'"
                    class="quick-path-tag"
                    @click="uploadTargetPath = path.path"
                  >
                    {{ path.label }}
                  </el-tag>
                </div>
                <div class="target-input-row">
                  <el-input 
                    v-model="uploadTargetPath" 
                    placeholder="输入目标路径"
                    class="target-input"
                  >
                    <template #prepend>
                      <el-icon><Folder /></el-icon>
                    </template>
                  </el-input>
                  <el-button @click="showTargetBrowser = true">
                    <el-icon><FolderOpened /></el-icon>
                    浏览
                  </el-button>
                </div>
              </div>
            </div>

            <!-- 上传预览 -->
            <div class="upload-preview" v-if="selectedFolderPath">
              <el-icon><Right /></el-icon>
              <span>将上传到:</span>
              <code>{{ uploadFullTargetPath }}</code>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      <div v-if="uploadProgress > 0" class="upload-progress">
        <el-progress :percentage="uploadProgress" :stroke-width="10" />
        <div class="progress-text">{{ uploadProgressText }}</div>
      </div>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button 
          v-if="uploadTab === 'files'" 
          type="primary" 
          @click="uploadFiles" 
          :loading="uploading"
          :disabled="uploadFileList.length === 0"
        >
          上传文件 ({{ uploadFileList.length }})
        </el-button>
        <el-button 
          v-else 
          type="primary" 
          @click="uploadFolder" 
          :loading="uploading"
          :disabled="!selectedFolderPath"
        >
          上传文件夹
        </el-button>
      </template>
    </el-dialog>

    <!-- 重命名对话框 -->
    <el-dialog v-model="showRenameDialog" title="重命名" width="400px">
      <el-form>
        <el-form-item label="新名称">
          <el-input v-model="renameNewName" placeholder="输入新名称" @keyup.enter="renameFile" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="renameFile">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改权限对话框 -->
    <el-dialog v-model="showChmodDialog" title="修改权限" width="400px">
      <el-form label-width="80px">
        <el-form-item label="权限值">
          <el-input v-model="chmodValue" placeholder="例如: 755" maxlength="3" />
        </el-form-item>
        <div class="chmod-preview">
          <div class="chmod-group">
            <span class="chmod-label">所有者:</span>
            <el-checkbox-group v-model="chmodOwner">
              <el-checkbox label="r">读</el-checkbox>
              <el-checkbox label="w">写</el-checkbox>
              <el-checkbox label="x">执行</el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="chmod-group">
            <span class="chmod-label">用户组:</span>
            <el-checkbox-group v-model="chmodGroup">
              <el-checkbox label="r">读</el-checkbox>
              <el-checkbox label="w">写</el-checkbox>
              <el-checkbox label="x">执行</el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="chmod-group">
            <span class="chmod-label">其他人:</span>
            <el-checkbox-group v-model="chmodOther">
              <el-checkbox label="r">读</el-checkbox>
              <el-checkbox label="w">写</el-checkbox>
              <el-checkbox label="x">执行</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="showChmodDialog = false">取消</el-button>
        <el-button type="primary" @click="changePermission">应用</el-button>
      </template>
    </el-dialog>

    <!-- 移动/复制对话框 -->
    <el-dialog v-model="showMoveDialog" :title="moveMode === 'move' ? '移动到' : '复制到'" width="500px">
      <el-form>
        <el-form-item label="目标路径">
          <el-input v-model="moveTargetPath" placeholder="输入目标路径" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMoveDialog = false">取消</el-button>
        <el-button type="primary" @click="moveOrCopyFile">确定</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览对话框 -->
    <el-dialog v-model="showImagePreview" title="图片预览" width="80%" top="5vh" class="image-preview-dialog">
      <div class="image-preview-container">
        <img :src="previewImageUrl" :alt="currentFile?.name" />
      </div>
      <div class="image-preview-info">
        <span>{{ currentFile?.name }}</span>
        <span>{{ formatSize(currentFile?.size || 0) }}</span>
      </div>
      <template #footer>
        <el-button @click="downloadFile(currentFile!)" v-if="currentFile">
          <el-icon><Download /></el-icon> 下载
        </el-button>
        <el-button @click="showImagePreview = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 压缩对话框 -->
    <el-dialog v-model="showCompressDialog" title="压缩文件" width="450px">
      <el-form label-width="100px">
        <el-form-item label="压缩文件名">
          <el-input v-model="compressFileName" placeholder="输入压缩文件名">
            <template #append>
              <el-select v-model="compressFormat" style="width: 100px">
                <el-option label=".tar.gz" value=".tar.gz" />
                <el-option label=".zip" value=".zip" />
                <el-option label=".tar" value=".tar" />
              </el-select>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="包含文件">
          <div class="compress-files-list">
            <el-tag v-for="file in compressFiles" :key="file.path" size="small" closable @close="removeCompressFile(file)">
              {{ file.name }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompressDialog = false">取消</el-button>
        <el-button type="primary" @click="doCompress" :loading="compressing">压缩</el-button>
      </template>
    </el-dialog>

    <!-- 解压对话框 -->
    <el-dialog v-model="showExtractDialog" title="解压文件" width="450px">
      <el-form label-width="100px">
        <el-form-item label="解压到">
          <el-input v-model="extractTargetPath" placeholder="输入目标路径" />
        </el-form-item>
        <el-form-item label="选项">
          <el-checkbox v-model="extractOverwrite">覆盖已存在的文件</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExtractDialog = false">取消</el-button>
        <el-button type="primary" @click="doExtract" :loading="extracting">解压</el-button>
      </template>
    </el-dialog>

    <!-- 文件比较对话框 -->
    <el-dialog v-model="showCompareDialog" title="文件比较" width="90%" top="3vh" class="compare-dialog">
      <div class="compare-toolbar">
        <div class="compare-files-info">
          <el-tag type="info">{{ compareFileA?.file.name }}</el-tag>
          <span class="compare-vs">VS</span>
          <el-tag type="warning">{{ compareFileB?.file.name }}</el-tag>
        </div>
        <el-radio-group v-model="compareMode" size="small">
          <el-radio-button value="side-by-side">并排对比</el-radio-button>
          <el-radio-button value="unified">统一视图</el-radio-button>
        </el-radio-group>
      </div>
      <div class="compare-content" v-if="compareFileA && compareFileB">
        <!-- 并排对比模式 -->
        <div v-if="compareMode === 'side-by-side'" class="side-by-side-view">
          <div class="compare-panel">
            <div class="compare-panel-header">
              <span>{{ compareFileA.file.name }}</span>
              <span class="file-size">{{ formatSize(compareFileA.file.size) }}</span>
            </div>
            <div class="compare-panel-content">
              <div class="line-numbers">
                <span v-for="(_, i) in compareFileA.content.split('\n')" :key="i">{{ i + 1 }}</span>
              </div>
              <pre class="code-content">{{ compareFileA.content }}</pre>
            </div>
          </div>
          <div class="compare-panel">
            <div class="compare-panel-header">
              <span>{{ compareFileB.file.name }}</span>
              <span class="file-size">{{ formatSize(compareFileB.file.size) }}</span>
            </div>
            <div class="compare-panel-content">
              <div class="line-numbers">
                <span v-for="(_, i) in compareFileB.content.split('\n')" :key="i">{{ i + 1 }}</span>
              </div>
              <pre class="code-content">{{ compareFileB.content }}</pre>
            </div>
          </div>
        </div>
        <!-- 统一视图模式 -->
        <div v-else class="unified-view">
          <div class="diff-content">
            <div
              v-for="(line, index) in computeDiffLines()"
              :key="index"
              class="diff-line"
              :class="line.type"
            >
              <span class="diff-indicator">{{ line.indicator }}</span>
              <span class="diff-text">{{ line.text }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCompareDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      @click="contextMenuVisible = false"
    >
      <div class="context-menu-item" @click="viewFile(contextMenuTarget!)" v-if="contextMenuTarget && !contextMenuTarget.isDir">
        <el-icon><View /></el-icon> 查看
      </div>
      <div class="context-menu-item" @click="handleDoubleClick(contextMenuTarget!)" v-if="contextMenuTarget?.isDir">
        <el-icon><FolderOpened /></el-icon> 打开
      </div>
      <div class="context-menu-item" @click="downloadFile(contextMenuTarget!)" v-if="contextMenuTarget && !contextMenuTarget.isDir">
        <el-icon><Download /></el-icon> 下载
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" @click="copyToClipboardSingle(contextMenuTarget!)">
        <el-icon><CopyDocument /></el-icon> 复制
      </div>
      <div class="context-menu-item" @click="cutToClipboardSingle(contextMenuTarget!)">
        <el-icon><Scissor /></el-icon> 剪切
      </div>
      <div class="context-menu-item" @click="pasteFiles" v-if="clipboard.files.length > 0">
        <el-icon><DocumentCopy /></el-icon> 粘贴
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" @click="handleFileAction('rename', contextMenuTarget!)">
        <el-icon><EditPen /></el-icon> 重命名
      </div>
      <div class="context-menu-item" @click="handleFileAction('chmod', contextMenuTarget!)">
        <el-icon><Lock /></el-icon> 修改权限
      </div>
      <div class="context-menu-item" @click="addToBookmarks(contextMenuTarget!)" v-if="contextMenuTarget?.isDir">
        <el-icon><Star /></el-icon> 添加到收藏
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" @click="deleteFile(contextMenuTarget!)">
        <el-icon><Delete /></el-icon> 删除
      </div>
    </div>

    <!-- 点击其他地方关闭右键菜单 -->
    <div v-if="contextMenuVisible" class="context-menu-overlay" @click="contextMenuVisible = false"></div>

    <!-- 目录浏览器对话框 -->
    <el-dialog v-model="showTargetBrowser" title="选择上传目录" width="500px">
      <div class="target-browser">
        <div class="browser-path">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item @click="browseToPath('/')" class="clickable">
              <el-icon><HomeFilled /></el-icon>
            </el-breadcrumb-item>
            <el-breadcrumb-item
              v-for="(part, index) in browserPathParts"
              :key="index"
              @click="browseToPathIndex(index)"
              class="clickable"
            >
              {{ part }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="browser-list" v-loading="browserLoading">
          <div 
            class="browser-item parent" 
            @click="browseToParent"
            v-if="browserPath !== '/'"
          >
            <el-icon><Top /></el-icon>
            <span>..</span>
          </div>
          <div 
            v-for="dir in browserDirs" 
            :key="dir.path"
            class="browser-item"
            :class="{ selected: browserPath === dir.path }"
            @click="browseToPath(dir.path)"
            @dblclick="selectBrowserPath(dir.path)"
          >
            <el-icon color="#f0b429"><Folder /></el-icon>
            <span>{{ dir.name }}</span>
          </div>
          <div v-if="browserDirs.length === 0 && !browserLoading" class="browser-empty">
            此目录下没有子文件夹
          </div>
        </div>
        <div class="browser-selected">
          <span>当前选择:</span>
          <code>{{ browserPath }}</code>
        </div>
      </div>
      <template #footer>
        <el-button @click="showTargetBrowser = false">取消</el-button>
        <el-button type="primary" @click="selectBrowserPath(browserPath)">选择此目录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import {
  Refresh, Top, Folder, Document, Search, Upload, Download,
  Delete, FolderAdd, DocumentAdd, HomeFilled, List, Grid,
  MoreFilled, View, Edit, Check, Picture, Star, Plus, Close,
  House, Position, CopyDocument, Scissor, Files, InfoFilled,
  VideoCamera, Headset, ZoomIn, EditPen, Rank, Lock, FolderOpened,
  DocumentCopy, Clock, Switch, Right
} from '@element-plus/icons-vue'

// 最近访问记录
interface RecentItem {
  path: string
  name: string
  isDir: boolean
  accessTime: number
}

// 文件比较
interface CompareFile {
  file: FileItem
  content: string
}

interface FileItem {
  name: string
  path: string
  isDir: boolean
  size: number
  mode: number
  modTime: number
}

interface Bookmark {
  name: string
  path: string
}

interface Clipboard {
  files: FileItem[]
  mode: 'copy' | 'cut'
  sourcePath: string
}

const route = useRoute()
const serverStore = useServerStore()

// 基础状态
const selectedServer = ref<string | null>(null)
const currentPath = ref('')
const files = ref<FileItem[]>([])
const loading = ref(false)
const searchQuery = ref('')
const recursiveSearch = ref(false)
const viewMode = ref<'list' | 'grid'>('list')
const selectedFiles = ref<FileItem[]>([])
const directPathInput = ref('')
const showInfoPanel = ref(false)

// 收藏夹
const bookmarks = ref<Bookmark[]>([
  { name: '主目录', path: '/home/admin' },
  { name: '配置目录', path: '/etc' },
  { name: '日志目录', path: '/var/log' }
])

// 剪贴板
const clipboard = ref<Clipboard>({
  files: [],
  mode: 'copy',
  sourcePath: ''
})

// 文件查看/编辑
const showFileDialog = ref(false)
const currentFile = ref<FileItem | null>(null)
const fileContent = ref('')
const editing = ref(false)

// 图片预览
const showImagePreview = ref(false)
const previewImageUrl = ref('')

// 新建文件夹/文件
const showNewFolderDialog = ref(false)
const showNewFileDialog = ref(false)
const newFolderName = ref('')
const newFileName = ref('')

// 上传
const showUploadDialog = ref(false)
const uploadTab = ref('files')
const uploadFileList = ref<UploadFile[]>([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadProgressText = ref('')

// 上传文件夹
const selectedFolderPath = ref('')
const folderFiles = ref<{ name: string; path: string; size: number; isDir: boolean }[]>([])
const uploadTargetPath = ref('/home')
const showTargetBrowser = ref(false)
const browserPath = ref('/')
const browserDirs = ref<FileItem[]>([])
const browserLoading = ref(false)

// 快捷上传路径
const quickUploadPaths = [
  { label: '/home', path: '/home' },
  { label: '/var/www', path: '/var/www' },
  { label: '/opt', path: '/opt' },
  { label: '/tmp', path: '/tmp' },
  { label: '当前目录', path: '' }
]

// 计算属性：选中的文件夹名称
const selectedFolderName = computed(() => {
  if (!selectedFolderPath.value) return ''
  return selectedFolderPath.value.split(/[/\\]/).pop() || 'folder'
})

// 计算属性：完整的上传目标路径
const uploadFullTargetPath = computed(() => {
  const base = uploadTargetPath.value || currentPath.value || '/'
  const folderName = selectedFolderName.value
  return `${base}/${folderName}`.replace(/\/+/g, '/')
})

// 计算属性：目录浏览器路径部分
const browserPathParts = computed(() => {
  if (!browserPath.value || browserPath.value === '/') return []
  return browserPath.value.split('/').filter(Boolean)
})

// 重命名
const showRenameDialog = ref(false)
const renameNewName = ref('')
const renameTarget = ref<FileItem | null>(null)

// 权限修改
const showChmodDialog = ref(false)
const chmodValue = ref('755')
const chmodOwner = ref<string[]>(['r', 'w', 'x'])
const chmodGroup = ref<string[]>(['r', 'x'])
const chmodOther = ref<string[]>(['r', 'x'])
const chmodTarget = ref<FileItem | null>(null)

// 移动/复制
const showMoveDialog = ref(false)
const moveMode = ref<'move' | 'copy'>('move')
const moveTargetPath = ref('')
const moveTarget = ref<FileItem | null>(null)

// 压缩/解压
const showCompressDialog = ref(false)
const compressFileName = ref('')
const compressFormat = ref('.tar.gz')
const compressFiles = ref<FileItem[]>([])
const compressing = ref(false)

const showExtractDialog = ref(false)
const extractTargetPath = ref('')
const extractOverwrite = ref(false)
const extracting = ref(false)

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<FileItem | null>(null)

// 最近访问历史
const recentHistory = ref<RecentItem[]>([])
const showHistoryPanel = ref(false)
const maxHistoryItems = 20

// 文件内容搜索
const contentSearchMode = ref(false)
const contentSearchResults = ref<{ file: FileItem; matches: string[] }[]>([])
const isSearchingContent = ref(false)

// 文件比较
const showCompareDialog = ref(false)
const compareFileA = ref<CompareFile | null>(null)
const compareFileB = ref<CompareFile | null>(null)
const compareMode = ref<'side-by-side' | 'unified'>('side-by-side')

// 代码高亮语言映射
const languageMap: Record<string, string> = {
  js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
  java: 'java', go: 'go', rs: 'rust', c: 'c', cpp: 'cpp', h: 'c',
  vue: 'vue', jsx: 'jsx', tsx: 'tsx', html: 'html', css: 'css',
  scss: 'scss', json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', sh: 'bash', bash: 'bash', sql: 'sql', php: 'php'
}

const connectedServers = computed(() => serverStore.connectedServers)
const pathParts = computed(() => currentPath.value.split('/').filter(Boolean))

const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value
  const query = searchQuery.value.toLowerCase()
  return files.value.filter(f => f.name.toLowerCase().includes(query))
})

// 文件内容行数（用于行号显示）
const fileContentLines = computed(() => {
  if (!fileContent.value) return 0
  return fileContent.value.split('\n').length
})

// 从路由参数获取服务器ID
if (route.params.serverId) {
  selectedServer.value = route.params.serverId as string
} else if (serverStore.currentServerId) {
  selectedServer.value = serverStore.currentServerId
}

watch(selectedServer, (newVal) => {
  if (newVal) {
    currentPath.value = ''
    loadDirectory()
  }
}, { immediate: true })

async function loadDirectory() {
  if (!selectedServer.value) return

  loading.value = true
  selectedFiles.value = []
  try {
    const path = currentPath.value || '/'
    const result = await window.electronAPI.file.list(selectedServer.value, path)
    
    // 转换 API 返回的格式 (snake_case -> camelCase)
    files.value = result.files.map((f: any) => ({
      name: f.name,
      path: f.path,
      isDir: f.is_dir,
      size: f.size,
      mode: f.mode,
      modTime: f.mod_time
    }))
    
    // 排序：目录在前
    files.value.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1
      if (!a.isDir && b.isDir) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    ElMessage.error(`加载目录失败: ${(error as Error).message}`)
    files.value = []
  } finally {
    loading.value = false
  }
}

function handleDoubleClick(row: FileItem) {
  if (row.isDir) {
    currentPath.value = row.path
    loadDirectory()
    // 添加目录到历史记录
    addToHistory(row)
  } else {
    viewFile(row)
  }
}

function navigateToRoot() {
  currentPath.value = ''
  loadDirectory()
}

function navigateTo(index: number) {
  const parts = pathParts.value.slice(0, index + 1)
  currentPath.value = '/' + parts.join('/')
  loadDirectory()
}

function goUp() {
  const parts = pathParts.value
  if (parts.length > 0) {
    parts.pop()
    currentPath.value = parts.length > 0 ? '/' + parts.join('/') : ''
    loadDirectory()
  }
}

function refresh() {
  loadDirectory()
}

function searchFiles() {
  // 搜索在 filteredFiles computed 中处理
  if (searchQuery.value) {
    if (contentSearchMode.value) {
      // 内容搜索模式
      searchFileContent()
    } else {
      ElMessage.info(`搜索: ${searchQuery.value}`)
    }
  }
}

// 文件内容搜索
async function searchFileContent() {
  if (!searchQuery.value.trim() || !selectedServer.value) return
  isSearchingContent.value = true
  contentSearchResults.value = []

  try {
    const query = searchQuery.value.toLowerCase()
    const results: { file: FileItem; matches: string[] }[] = []

    // 遍历当前目录下的文件，读取内容并搜索
    for (const file of files.value) {
      if (!file.isDir) {
        try {
          const content = await readFileContent(file)
          const lines = content.split('\n')
          const matches: string[] = []

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query)) {
              matches.push(`${index + 1}: ${line.trim().substring(0, 100)}`)
            }
          })

          if (matches.length > 0) {
            results.push({ file, matches })
          }
        } catch {
          // 跳过无法读取的文件（如二进制文件）
        }
      }
    }

    contentSearchResults.value = results
    if (results.length > 0) {
      ElMessage.success(`找到 ${results.length} 个文件包含 "${searchQuery.value}"`)
    } else {
      ElMessage.info(`未找到包含 "${searchQuery.value}" 的文件`)
    }
  } catch (error) {
    ElMessage.error(`搜索失败: ${(error as Error).message}`)
  } finally {
    isSearchingContent.value = false
  }
}

// 最近访问历史相关函数
function addToHistory(item: FileItem) {
  // 移除已存在的相同路径
  const existingIndex = recentHistory.value.findIndex(h => h.path === item.path)
  if (existingIndex >= 0) {
    recentHistory.value.splice(existingIndex, 1)
  }

  // 添加到开头
  recentHistory.value.unshift({
    path: item.path,
    name: item.name,
    isDir: item.isDir,
    accessTime: Date.now()
  })

  // 限制历史记录数量
  if (recentHistory.value.length > maxHistoryItems) {
    recentHistory.value = recentHistory.value.slice(0, maxHistoryItems)
  }

  // 保存到 localStorage
  saveHistory()
}

function saveHistory() {
  try {
    localStorage.setItem('serverhub_file_history', JSON.stringify(recentHistory.value))
  } catch (e) {
    console.error('Failed to save history:', e)
  }
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('serverhub_file_history')
    if (saved) {
      recentHistory.value = JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load history:', e)
  }
}

function clearHistory() {
  recentHistory.value = []
  localStorage.removeItem('serverhub_file_history')
  ElMessage.success('历史记录已清空')
}

function navigateToHistoryItem(item: RecentItem) {
  showHistoryPanel.value = false
  if (item.isDir) {
    currentPath.value = item.path
    loadDirectory()
  } else {
    // 导航到文件所在目录并打开文件
    const dirPath = item.path.substring(0, item.path.lastIndexOf('/'))
    currentPath.value = dirPath
    loadDirectory().then(() => {
      const file = files.value.find(f => f.path === item.path)
      if (file) {
        viewFile(file)
      }
    })
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

// 文件语言检测
function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return languageMap[ext] || 'text'
}

// 复制文件内容
function copyFileContent() {
  if (fileContent.value) {
    navigator.clipboard.writeText(fileContent.value).then(() => {
      ElMessage.success('内容已复制到剪贴板')
    }).catch(() => {
      ElMessage.error('复制失败')
    })
  }
}

// 文件比较功能
async function compareSelectedFiles() {
  if (selectedFiles.value.length !== 2) {
    ElMessage.warning('请选择两个文件进行比较')
    return
  }

  const [fileA, fileB] = selectedFiles.value
  if (fileA.isDir || fileB.isDir) {
    ElMessage.warning('只能比较文件，不能比较文件夹')
    return
  }

  try {
    // 获取两个文件的内容
    const contentA = await readFileContent(fileA)
    const contentB = await readFileContent(fileB)

    compareFileA.value = { file: fileA, content: contentA }
    compareFileB.value = { file: fileB, content: contentB }
    showCompareDialog.value = true
  } catch (error) {
    ElMessage.error(`加载文件失败: ${(error as Error).message}`)
  }
}

// 计算差异行（简单实现）
function computeDiffLines(): { type: string; indicator: string; text: string }[] {
  if (!compareFileA.value || !compareFileB.value) return []

  const linesA = compareFileA.value.content.split('\n')
  const linesB = compareFileB.value.content.split('\n')
  const result: { type: string; indicator: string; text: string }[] = []

  const maxLines = Math.max(linesA.length, linesB.length)

  for (let i = 0; i < maxLines; i++) {
    const lineA = linesA[i]
    const lineB = linesB[i]

    if (lineA === undefined) {
      result.push({ type: 'added', indicator: '+', text: lineB })
    } else if (lineB === undefined) {
      result.push({ type: 'removed', indicator: '-', text: lineA })
    } else if (lineA !== lineB) {
      result.push({ type: 'removed', indicator: '-', text: lineA })
      result.push({ type: 'added', indicator: '+', text: lineB })
    } else {
      result.push({ type: 'unchanged', indicator: ' ', text: lineA })
    }
  }

  return result
}

// 文件选择
function handleSelectionChange(selection: FileItem[]) {
  selectedFiles.value = selection
}

function toggleFileSelection(file: FileItem) {
  const index = selectedFiles.value.findIndex(f => f.path === file.path)
  if (index >= 0) {
    selectedFiles.value.splice(index, 1)
  } else {
    selectedFiles.value.push(file)
  }
}

// 文件查看/编辑
async function viewFile(file: FileItem) {
  if (!selectedServer.value) return
  
  try {
    currentFile.value = file
    // 调用真实 API 读取文件内容
    const result = await window.electronAPI.file.read(selectedServer.value, file.path)
    // 将 Buffer 转换为字符串
    if (result.content) {
      if (typeof result.content === 'string') {
        fileContent.value = result.content
      } else if (result.content instanceof Uint8Array || ArrayBuffer.isView(result.content)) {
        fileContent.value = new TextDecoder().decode(result.content)
      } else if (typeof result.content === 'object' && result.content.data) {
        // 处理序列化的 Buffer 对象 { type: 'Buffer', data: [...] }
        fileContent.value = new TextDecoder().decode(new Uint8Array(result.content.data))
      } else {
        fileContent.value = String(result.content)
      }
    } else {
      fileContent.value = ''
    }
    editing.value = false
    showFileDialog.value = true
    // 添加到历史记录
    addToHistory(file)
  } catch (error) {
    ElMessage.error(`读取文件失败: ${(error as Error).message}`)
  }
}

// 读取文件内容的辅助函数
async function readFileContent(file: FileItem): Promise<string> {
  if (!selectedServer.value) throw new Error('未选择服务器')
  
  const result = await window.electronAPI.file.read(selectedServer.value, file.path)
  if (result.content) {
    if (typeof result.content === 'string') {
      return result.content
    } else if (result.content instanceof Uint8Array || ArrayBuffer.isView(result.content)) {
      return new TextDecoder().decode(result.content)
    } else if (typeof result.content === 'object' && result.content.data) {
      return new TextDecoder().decode(new Uint8Array(result.content.data))
    } else {
      return String(result.content)
    }
  }
  return ''
}

async function saveFile() {
  if (!selectedServer.value || !currentFile.value) return
  
  try {
    await window.electronAPI.file.write(selectedServer.value, currentFile.value.path, fileContent.value)
    ElMessage.success('文件已保存')
    editing.value = false
  } catch (error) {
    ElMessage.error(`保存失败: ${(error as Error).message}`)
  }
}

async function deleteFile(file: FileItem) {
  if (!selectedServer.value) return
  
  try {
    await ElMessageBox.confirm(`确定要删除 ${file.name} 吗？`, '确认删除', {
      type: 'warning'
    })
    await window.electronAPI.file.delete(selectedServer.value, file.path)
    files.value = files.value.filter(f => f.path !== file.path)
    ElMessage.success('已删除')
  } catch {
    // 取消或删除失败
  }
}

async function deleteSelected() {
  if (selectedFiles.value.length === 0 || !selectedServer.value) return
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedFiles.value.length} 个文件吗？`,
      '确认删除',
      { type: 'warning' }
    )
    // 逐个删除选中的文件
    const deletedPaths: string[] = []
    for (const file of selectedFiles.value) {
      try {
        await window.electronAPI.file.delete(selectedServer.value, file.path)
        deletedPaths.push(file.path)
      } catch (error) {
        ElMessage.error(`删除 ${file.name} 失败: ${(error as Error).message}`)
      }
    }
    files.value = files.value.filter(f => !deletedPaths.includes(f.path))
    selectedFiles.value = []
    if (deletedPaths.length > 0) {
      ElMessage.success(`已删除 ${deletedPaths.length} 个文件`)
    }
  } catch {
    // 取消
  }
}

// 新建文件夹
async function createFolder() {
  if (!newFolderName.value.trim() || !selectedServer.value) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  try {
    const basePath = currentPath.value || ''
    const folderPath = `${basePath}/${newFolderName.value}`.replace(/\/+/g, '/')
    
    // 通过执行命令创建目录
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value, 
      'mkdir', 
      ['-p', folderPath]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '创建目录失败')
    }
    
    showNewFolderDialog.value = false
    newFolderName.value = ''
    ElMessage.success('文件夹已创建')
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`创建失败: ${(error as Error).message}`)
  }
}

// 新建文件
async function createFile() {
  if (!newFileName.value.trim() || !selectedServer.value) {
    ElMessage.warning('请输入文件名称')
    return
  }
  try {
    const basePath = currentPath.value || ''
    const filePath = `${basePath}/${newFileName.value}`.replace(/\/+/g, '/')
    
    // 通过 API 创建空文件
    await window.electronAPI.file.write(selectedServer.value, filePath, '')
    
    showNewFileDialog.value = false
    newFileName.value = ''
    ElMessage.success('文件已创建')
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`创建失败: ${(error as Error).message}`)
  }
}

// 上传
function handleUploadChange(file: UploadFile) {
  if (!uploadFileList.value.find(f => f.name === file.name)) {
    uploadFileList.value.push(file)
  }
}

async function uploadFiles() {
  if (uploadFileList.value.length === 0 || !selectedServer.value) {
    ElMessage.warning('请选择要上传的文件')
    return
  }
  uploading.value = true
  uploadProgress.value = 0
  uploadProgressText.value = '准备上传...'
  
  try {
    const basePath = currentPath.value || '/'
    const totalFiles = uploadFileList.value.length
    
    for (let i = 0; i < totalFiles; i++) {
      const file = uploadFileList.value[i]
      const remotePath = `${basePath}/${file.name}`.replace(/\/+/g, '/')
      
      uploadProgressText.value = `上传 ${file.name} (${i + 1}/${totalFiles})`
      
      // 读取文件内容
      if (file.raw) {
        const arrayBuffer = await file.raw.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)
        
        // 上传文件
        await window.electronAPI.file.uploadStream(selectedServer.value, data, remotePath, {
          mode: 0o644,
          createDirs: true
        })
      }
      
      uploadProgress.value = Math.round(((i + 1) / totalFiles) * 100)
    }
    
    showUploadDialog.value = false
    uploadFileList.value = []
    uploadProgress.value = 0
    uploadProgressText.value = ''
    ElMessage.success('上传完成')
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`上传失败: ${(error as Error).message}`)
  } finally {
    uploading.value = false
  }
}

// 选择本地文件夹
async function selectLocalFolder() {
  try {
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择要上传的文件夹'
    })
    
    if (result.canceled || !result.filePaths.length) return
    
    selectedFolderPath.value = result.filePaths[0]
    
    // 扫描文件夹
    try {
      folderFiles.value = await window.electronAPI.fs.scanDirectory(selectedFolderPath.value, {
        ignore: ['node_modules', '.git', '__pycache__', '.venv', 'venv', '.next', '.nuxt']
      })
    } catch {
      // 如果扫描失败，显示基本信息
      const folderName = selectedFolderPath.value.split(/[/\\]/).pop() || 'folder'
      folderFiles.value = [{ name: folderName, path: folderName, size: 0, isDir: true }]
    }
    
    // 如果快捷路径选择了"当前目录"，更新为实际当前路径
    if (uploadTargetPath.value === '') {
      uploadTargetPath.value = currentPath.value || '/home'
    }
  } catch (e) {
    ElMessage.error('选择文件夹失败: ' + (e as Error).message)
  }
}

// 目录浏览器：浏览到指定路径
async function browseToPath(path: string) {
  if (!selectedServer.value) return
  
  browserLoading.value = true
  browserPath.value = path
  
  try {
    const result = await window.electronAPI.file.list(selectedServer.value, path)
    // 转换 API 返回的格式 (is_dir -> isDir)
    browserDirs.value = result.files
      .filter((f: any) => f.is_dir)
      .map((f: any) => ({
        name: f.name,
        path: f.path,
        isDir: true,
        size: f.size,
        mode: f.mode,
        modTime: f.mod_time
      }))
      .sort((a: FileItem, b: FileItem) => a.name.localeCompare(b.name))
  } catch (e) {
    ElMessage.error('加载目录失败: ' + (e as Error).message)
    browserDirs.value = []
  } finally {
    browserLoading.value = false
  }
}

// 目录浏览器：浏览到父目录
function browseToParent() {
  if (browserPath.value === '/') return
  const parts = browserPath.value.split('/').filter(Boolean)
  parts.pop()
  browseToPath('/' + parts.join('/'))
}

// 目录浏览器：通过索引浏览
function browseToPathIndex(index: number) {
  const parts = browserPath.value.split('/').filter(Boolean)
  browseToPath('/' + parts.slice(0, index + 1).join('/'))
}

// 目录浏览器：选择路径
function selectBrowserPath(path: string) {
  uploadTargetPath.value = path
  showTargetBrowser.value = false
}

// 打开目录浏览器时初始化
watch(showTargetBrowser, (val) => {
  if (val) {
    browseToPath(uploadTargetPath.value || '/')
  }
})

// 上传文件夹
async function uploadFolder() {
  if (!selectedServer.value || !selectedFolderPath.value) return
  
  uploading.value = true
  uploadProgress.value = 0
  uploadProgressText.value = '准备上传...'
  
  try {
    // 使用用户选择的目标路径
    const basePath = uploadTargetPath.value || currentPath.value || '/'
    const folderName = selectedFolderPath.value.split(/[/\\]/).pop() || 'upload'
    const fullTargetPath = `${basePath}/${folderName}`.replace(/\/+/g, '/')
    
    console.log('[uploadFolder] Target path:', fullTargetPath)
    console.log('[uploadFolder] Source folder:', selectedFolderPath.value)
    
    // 打包文件夹
    uploadProgressText.value = '打包文件...'
    const tarData = await window.electronAPI.fs.packDirectory(selectedFolderPath.value, {
      ignore: ['node_modules', '.git', '__pycache__', '.venv', 'venv', '.next', '.nuxt', 'target', 'vendor']
    })
    
    // tarData 从 IPC 返回后是 Uint8Array 或序列化的对象
    let tarBytes: Uint8Array
    if (tarData instanceof Uint8Array) {
      tarBytes = tarData
    } else if (tarData && typeof tarData === 'object' && (tarData as any).type === 'Buffer' && Array.isArray((tarData as any).data)) {
      // IPC 序列化后的 Buffer 格式
      tarBytes = new Uint8Array((tarData as any).data)
    } else if (ArrayBuffer.isView(tarData)) {
      tarBytes = new Uint8Array(tarData.buffer)
    } else {
      console.error('[uploadFolder] Unknown tarData type:', typeof tarData, tarData)
      throw new Error('Invalid tar data format')
    }
    
    console.log('[uploadFolder] Tar bytes size:', tarBytes.length)
    uploadProgress.value = 20
    
    if (tarBytes.length < 100) {
      throw new Error('打包文件太小，可能打包失败')
    }
    
    // 使用 gRPC 流式上传
    uploadProgressText.value = '上传中...'
    
    // 临时文件路径
    const tempTarPath = `/tmp/upload_${Date.now()}.tar.gz`
    
    // 监听上传进度
    const removeProgressListener = window.electronAPI.file.onUploadProgress(tempTarPath, (progress) => {
      uploadProgress.value = 20 + Math.floor(progress.percent * 0.6) // 20-80%
      uploadProgressText.value = `上传中... ${Math.floor(progress.sent / 1024)}KB / ${Math.floor(progress.total / 1024)}KB`
    })
    
    try {
      // 流式上传并解压
      const result = await window.electronAPI.file.uploadStream(
        selectedServer.value,
        tarBytes,
        tempTarPath,
        {
          mode: 0o644,
          createDirs: true,
          isTarGz: true,
          extractTo: fullTargetPath
        }
      )
      
      if (!result.success) {
        throw new Error(result.message || '上传失败')
      }
      
      console.log('[uploadFolder] Upload result:', result)
    } finally {
      removeProgressListener()
    }
    
    uploadProgress.value = 100
    uploadProgressText.value = '上传完成!'
    
    // 刷新文件列表
    await loadDirectory()
    
    showUploadDialog.value = false
    selectedFolderPath.value = ''
    folderFiles.value = []
    uploadProgress.value = 0
    uploadProgressText.value = ''
    
    ElMessage.success(`文件夹已上传到 ${fullTargetPath}`)
  } catch (e) {
    console.error('[uploadFolder] Error:', e)
    uploadProgressText.value = '上传失败: ' + (e as Error).message
    ElMessage.error('上传失败: ' + (e as Error).message)
  } finally {
    uploading.value = false
  }
}

// 下载
function downloadFile(file: FileItem) {
  ElMessage.success(`开始下载: ${file.name}`)
}

function downloadSelected() {
  if (selectedFiles.value.length === 0) return
  ElMessage.success(`开始下载 ${selectedFiles.value.length} 个文件`)
}

// 文件操作菜单
function handleFileAction(command: string, file: FileItem) {
  switch (command) {
    case 'rename':
      renameTarget.value = file
      renameNewName.value = file.name
      showRenameDialog.value = true
      break
    case 'copy':
      copyToClipboardSingle(file)
      break
    case 'cut':
      cutToClipboardSingle(file)
      break
    case 'move':
      moveTarget.value = file
      moveMode.value = 'move'
      moveTargetPath.value = currentPath.value
      showMoveDialog.value = true
      break
    case 'chmod':
      chmodTarget.value = file
      const mode = file.mode & 0o777
      chmodValue.value = mode.toString(8).padStart(3, '0')
      updateChmodCheckboxes(mode)
      showChmodDialog.value = true
      break
    case 'compress':
      compressFiles.value = [file]
      compressFileName.value = file.name.replace(/\.[^/.]+$/, '')
      showCompressDialog.value = true
      break
    case 'extract':
      currentFile.value = file
      extractTargetPath.value = currentPath.value
      showExtractDialog.value = true
      break
    case 'delete':
      deleteFile(file)
      break
  }
}

// 重命名
async function renameFile() {
  if (!renameNewName.value.trim() || !renameTarget.value || !selectedServer.value) {
    ElMessage.warning('请输入新名称')
    return
  }
  try {
    const basePath = currentPath.value || ''
    const oldPath = renameTarget.value.path
    const newPath = `${basePath}/${renameNewName.value}`.replace(/\/+/g, '/')
    
    // 通过执行 mv 命令重命名
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'mv',
      [oldPath, newPath]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '重命名失败')
    }
    
    showRenameDialog.value = false
    ElMessage.success('重命名成功')
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`重命名失败: ${(error as Error).message}`)
  }
}

// 权限修改
function updateChmodCheckboxes(mode: number) {
  chmodOwner.value = []
  chmodGroup.value = []
  chmodOther.value = []
  if (mode & 0o400) chmodOwner.value.push('r')
  if (mode & 0o200) chmodOwner.value.push('w')
  if (mode & 0o100) chmodOwner.value.push('x')
  if (mode & 0o040) chmodGroup.value.push('r')
  if (mode & 0o020) chmodGroup.value.push('w')
  if (mode & 0o010) chmodGroup.value.push('x')
  if (mode & 0o004) chmodOther.value.push('r')
  if (mode & 0o002) chmodOther.value.push('w')
  if (mode & 0o001) chmodOther.value.push('x')
}

async function changePermission() {
  if (!chmodTarget.value || !selectedServer.value) return
  try {
    // 通过执行 chmod 命令修改权限
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'chmod',
      [chmodValue.value, chmodTarget.value.path]
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '修改权限失败')
    }
    
    showChmodDialog.value = false
    ElMessage.success('权限已修改')
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`修改失败: ${(error as Error).message}`)
  }
}

// 移动/复制
async function moveOrCopyFile() {
  if (!moveTarget.value || !moveTargetPath.value || !selectedServer.value) {
    ElMessage.warning('请输入目标路径')
    return
  }
  try {
    const sourcePath = moveTarget.value.path
    const targetPath = `${moveTargetPath.value}/${moveTarget.value.name}`.replace(/\/+/g, '/')
    
    // 通过执行 mv 或 cp 命令
    const command = moveMode.value === 'move' ? 'mv' : 'cp'
    const args = moveMode.value === 'move' ? [sourcePath, targetPath] : ['-r', sourcePath, targetPath]
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      command,
      args
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '操作失败')
    }
    
    showMoveDialog.value = false
    ElMessage.success(moveMode.value === 'move' ? '移动成功' : '复制成功')
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`操作失败: ${(error as Error).message}`)
  }
}

// 工具函数
function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext || '')
}

function isVideoFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext || '')
}

function isAudioFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext || '')
}

function isArchiveFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz', 'tgz'].includes(ext || '') ||
    name.endsWith('.tar.gz') || name.endsWith('.tar.bz2')
}

function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const types: Record<string, string> = {
    // 图片
    jpg: '图片', jpeg: '图片', png: '图片', gif: '图片', bmp: '图片', webp: '图片', svg: '图片',
    // 视频
    mp4: '视频', avi: '视频', mkv: '视频', mov: '视频', wmv: '视频',
    // 音频
    mp3: '音频', wav: '音频', flac: '音频', aac: '音频', ogg: '音频',
    // 文档
    pdf: 'PDF文档', doc: 'Word文档', docx: 'Word文档', xls: 'Excel表格', xlsx: 'Excel表格',
    ppt: 'PPT演示', pptx: 'PPT演示', txt: '文本文件', md: 'Markdown',
    // 代码
    js: 'JavaScript', ts: 'TypeScript', py: 'Python', java: 'Java', go: 'Go',
    rs: 'Rust', c: 'C', cpp: 'C++', h: 'C头文件', vue: 'Vue组件',
    html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON', xml: 'XML', yaml: 'YAML',
    // 压缩包
    zip: 'ZIP压缩包', tar: 'TAR归档', gz: 'GZ压缩', rar: 'RAR压缩', '7z': '7Z压缩',
    // 配置
    conf: '配置文件', ini: '配置文件', cfg: '配置文件', env: '环境变量',
    // 日志
    log: '日志文件',
    // 脚本
    sh: 'Shell脚本', bash: 'Bash脚本', ps1: 'PowerShell脚本', bat: '批处理脚本'
  }
  return types[ext] || `${ext.toUpperCase()} 文件`
}

function getFileIconColor(file: FileItem): string {
  if (file.isDir) return '#f0b429'
  if (isImageFile(file.name)) return '#10b981'
  if (isVideoFile(file.name)) return '#8b5cf6'
  if (isAudioFile(file.name)) return '#ec4899'
  if (isArchiveFile(file.name)) return '#f59e0b'
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (['js', 'ts', 'vue', 'jsx', 'tsx'].includes(ext)) return '#3b82f6'
  if (['py', 'java', 'go', 'rs', 'c', 'cpp'].includes(ext)) return '#6366f1'
  if (['json', 'yaml', 'xml', 'conf', 'ini'].includes(ext)) return '#14b8a6'
  if (['log'].includes(ext)) return '#64748b'
  return '#6b7280'
}

function sortBySize(a: FileItem, b: FileItem): number {
  return a.size - b.size
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('zh-CN')
}

function formatMode(mode: number): string {
  const octal = (mode & 0o777).toString(8)
  return octal.padStart(3, '0')
}

// 导航功能
function goHome() {
  currentPath.value = '/home/admin'
  loadDirectory()
}

function navigateToDirectPath() {
  if (directPathInput.value.trim()) {
    currentPath.value = directPathInput.value.trim()
    loadDirectory()
    directPathInput.value = ''
  }
}

// 收藏夹功能
function addBookmark() {
  if (!currentPath.value) return
  const exists = bookmarks.value.some(b => b.path === currentPath.value)
  if (exists) {
    ElMessage.warning('该路径已在收藏夹中')
    return
  }
  const name = currentPath.value.split('/').pop() || currentPath.value
  bookmarks.value.push({ name, path: currentPath.value })
  ElMessage.success('已添加到收藏夹')
}

function addToBookmarks(file: FileItem) {
  if (!file.isDir) return
  const exists = bookmarks.value.some(b => b.path === file.path)
  if (exists) {
    ElMessage.warning('该路径已在收藏夹中')
    return
  }
  bookmarks.value.push({ name: file.name, path: file.path })
  ElMessage.success('已添加到收藏夹')
}

function removeBookmark(index: number) {
  bookmarks.value.splice(index, 1)
  ElMessage.success('已从收藏夹移除')
}

function navigateToBookmark(bookmark: Bookmark) {
  currentPath.value = bookmark.path
  loadDirectory()
}

// 剪贴板功能
function copyToClipboard() {
  if (selectedFiles.value.length === 0) return
  clipboard.value = {
    files: [...selectedFiles.value],
    mode: 'copy',
    sourcePath: currentPath.value
  }
  ElMessage.success(`已复制 ${selectedFiles.value.length} 个文件`)
}

function cutToClipboard() {
  if (selectedFiles.value.length === 0) return
  clipboard.value = {
    files: [...selectedFiles.value],
    mode: 'cut',
    sourcePath: currentPath.value
  }
  ElMessage.success(`已剪切 ${selectedFiles.value.length} 个文件`)
}

function copyToClipboardSingle(file: FileItem) {
  clipboard.value = {
    files: [file],
    mode: 'copy',
    sourcePath: currentPath.value
  }
  ElMessage.success(`已复制: ${file.name}`)
}

function cutToClipboardSingle(file: FileItem) {
  clipboard.value = {
    files: [file],
    mode: 'cut',
    sourcePath: currentPath.value
  }
  ElMessage.success(`已剪切: ${file.name}`)
}

function clearClipboard() {
  clipboard.value = { files: [], mode: 'copy', sourcePath: '' }
}

function isClipboardFile(file: FileItem): boolean {
  return clipboard.value.files.some(f => f.path === file.path)
}

async function pasteFiles() {
  if (clipboard.value.files.length === 0 || !selectedServer.value) return
  try {
    const basePath = currentPath.value || '/'
    const command = clipboard.value.mode === 'cut' ? 'mv' : 'cp'
    
    for (const file of clipboard.value.files) {
      const targetPath = `${basePath}/${file.name}`.replace(/\/+/g, '/')
      const args = clipboard.value.mode === 'cut' 
        ? [file.path, targetPath] 
        : ['-r', file.path, targetPath]
      
      const result = await window.electronAPI.server.executeCommand(
        selectedServer.value,
        command,
        args
      )
      
      if (result.exit_code !== 0) {
        throw new Error(result.stderr || `${clipboard.value.mode === 'cut' ? '移动' : '复制'} ${file.name} 失败`)
      }
    }

    ElMessage.success(`已粘贴 ${clipboard.value.files.length} 个文件`)
    clearClipboard()
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`粘贴失败: ${(error as Error).message}`)
  }
}

// 图片预览
async function previewImage(file: FileItem) {
  if (!selectedServer.value) return
  
  currentFile.value = file
  try {
    // 通过 API 读取图片文件内容
    const result = await window.electronAPI.file.read(selectedServer.value, file.path)
    if (result.content) {
      let imageData: Uint8Array
      if (result.content instanceof Uint8Array) {
        imageData = result.content
      } else if (ArrayBuffer.isView(result.content)) {
        imageData = new Uint8Array(result.content.buffer)
      } else if (typeof result.content === 'object' && result.content.data) {
        // 处理序列化的 Buffer 对象 { type: 'Buffer', data: [...] }
        imageData = new Uint8Array(result.content.data)
      } else {
        throw new Error('无法解析图片数据')
      }
      
      // 根据文件扩展名确定 MIME 类型
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon'
      }
      const mimeType = mimeTypes[ext] || 'image/png'
      
      // 将二进制数据转换为 base64
      const base64 = btoa(
        imageData.reduce((data, byte) => data + String.fromCharCode(byte), '')
      )
      previewImageUrl.value = `data:${mimeType};base64,${base64}`
      showImagePreview.value = true
    }
  } catch (error) {
    ElMessage.error(`加载图片失败: ${(error as Error).message}`)
  }
}

// 压缩功能
function compressSelected() {
  if (selectedFiles.value.length === 0) return
  compressFiles.value = [...selectedFiles.value]
  compressFileName.value = selectedFiles.value.length === 1
    ? selectedFiles.value[0].name.replace(/\.[^/.]+$/, '')
    : 'archive'
  showCompressDialog.value = true
}

function removeCompressFile(file: FileItem) {
  compressFiles.value = compressFiles.value.filter(f => f.path !== file.path)
}

async function doCompress() {
  if (!compressFileName.value.trim() || !selectedServer.value) {
    ElMessage.warning('请输入压缩文件名')
    return
  }
  compressing.value = true
  try {
    const basePath = currentPath.value || '/'
    const archiveName = compressFileName.value + compressFormat.value
    const archivePath = `${basePath}/${archiveName}`.replace(/\/+/g, '/')
    const filePaths = compressFiles.value.map(f => f.path)
    
    // 根据压缩格式选择命令
    let command: string
    let args: string[]
    
    if (compressFormat.value === '.tar.gz') {
      command = 'tar'
      args = ['-czf', archivePath, ...filePaths]
    } else if (compressFormat.value === '.zip') {
      command = 'zip'
      args = ['-r', archivePath, ...filePaths]
    } else if (compressFormat.value === '.tar') {
      command = 'tar'
      args = ['-cf', archivePath, ...filePaths]
    } else {
      throw new Error('不支持的压缩格式')
    }
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      command,
      args
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '压缩失败')
    }
    
    showCompressDialog.value = false
    compressFiles.value = []
    compressFileName.value = ''
    ElMessage.success('压缩完成')
    // 刷新目录列表
    await loadDirectory()
  } catch (error) {
    ElMessage.error(`压缩失败: ${(error as Error).message}`)
  } finally {
    compressing.value = false
  }
}

// 解压功能
async function doExtract() {
  if (!extractTargetPath.value.trim() || !selectedServer.value || !currentFile.value) {
    ElMessage.warning('请输入目标路径')
    return
  }
  extracting.value = true
  try {
    const archivePath = currentFile.value.path
    const targetPath = extractTargetPath.value
    const fileName = currentFile.value.name.toLowerCase()
    
    // 先创建目标目录
    await window.electronAPI.server.executeCommand(
      selectedServer.value,
      'mkdir',
      ['-p', targetPath]
    )
    
    // 根据文件类型选择解压命令
    let command: string
    let args: string[]
    
    if (fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')) {
      command = 'tar'
      args = ['-xzf', archivePath, '-C', targetPath]
    } else if (fileName.endsWith('.tar.bz2')) {
      command = 'tar'
      args = ['-xjf', archivePath, '-C', targetPath]
    } else if (fileName.endsWith('.tar')) {
      command = 'tar'
      args = ['-xf', archivePath, '-C', targetPath]
    } else if (fileName.endsWith('.zip')) {
      command = 'unzip'
      args = extractOverwrite.value ? ['-o', archivePath, '-d', targetPath] : [archivePath, '-d', targetPath]
    } else if (fileName.endsWith('.gz')) {
      command = 'gunzip'
      args = ['-c', archivePath]
      // gunzip 需要重定向输出
    } else {
      throw new Error('不支持的压缩格式')
    }
    
    const result = await window.electronAPI.server.executeCommand(
      selectedServer.value,
      command,
      args
    )
    
    if (result.exit_code !== 0) {
      throw new Error(result.stderr || '解压失败')
    }
    
    showExtractDialog.value = false
    extractTargetPath.value = ''
    ElMessage.success('解压完成')
  } catch (error) {
    ElMessage.error(`解压失败: ${(error as Error).message}`)
  } finally {
    extracting.value = false
  }
}

// 右键菜单
function handleContextMenu(file: FileItem, event: MouseEvent) {
  event.preventDefault()
  contextMenuTarget.value = file
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

function handleEmptyContextMenu(event: MouseEvent) {
  event.preventDefault()
  contextMenuTarget.value = null
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

// 键盘快捷键
function handleKeydown(event: KeyboardEvent) {
  // Ctrl+C 复制
  if (event.ctrlKey && event.key === 'c' && selectedFiles.value.length > 0) {
    event.preventDefault()
    copyToClipboard()
  }
  // Ctrl+X 剪切
  if (event.ctrlKey && event.key === 'x' && selectedFiles.value.length > 0) {
    event.preventDefault()
    cutToClipboard()
  }
  // Ctrl+V 粘贴
  if (event.ctrlKey && event.key === 'v' && clipboard.value.files.length > 0) {
    event.preventDefault()
    pasteFiles()
  }
  // Delete 删除
  if (event.key === 'Delete' && selectedFiles.value.length > 0) {
    event.preventDefault()
    deleteSelected()
  }
  // F2 重命名
  if (event.key === 'F2' && selectedFiles.value.length === 1) {
    event.preventDefault()
    handleFileAction('rename', selectedFiles.value[0])
  }
  // F5 刷新
  if (event.key === 'F5') {
    event.preventDefault()
    refresh()
  }
  // Backspace 返回上级
  if (event.key === 'Backspace' && currentPath.value) {
    event.preventDefault()
    goUp()
  }
}

// 生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // 加载历史记录
  loadHistory()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style lang="scss" scoped>
.files-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0;
    }

    .server-select {
      width: 180px;
    }
  }

  .header-right {
    .search-input {
      width: 250px;
    }
  }
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 16px;

  .path-nav {
    display: flex;
    align-items: center;
    gap: 12px;

    .breadcrumb-wrapper {
      padding: 4px 12px;
      background: var(--bg-tertiary);
      border-radius: 4px;

      .clickable {
        cursor: pointer;
        &:hover {
          color: var(--primary-color);
        }
      }
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.file-table {
  flex: 1;

  .file-name {
    cursor: pointer;
    &:hover {
      color: var(--primary-color);
    }
  }

  .permission {
    font-family: monospace;
    color: var(--text-secondary);
  }

  .danger-text {
    color: var(--danger-color);
  }
}

.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  min-height: 400px;

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--bg-tertiary);
    }

    &.selected {
      background: rgba(var(--el-color-primary-rgb), 0.1);
      border: 1px solid var(--primary-color);
    }

    .grid-icon {
      margin-bottom: 8px;
    }

    .grid-name {
      font-size: 13px;
      text-align: center;
      word-break: break-all;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .grid-info {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
  }

  .empty-folder {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

.file-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;

  .file-path {
    font-family: monospace;
    color: var(--text-secondary);
  }

  .file-size {
    color: var(--text-secondary);
  }
}

.file-editor {
  :deep(.el-textarea__inner) {
    font-family: 'Fira Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    background-color: var(--bg-color);
  }
}

.upload-area {
  width: 100%;

  :deep(.el-upload-dragger) {
    width: 100%;
  }
}

.upload-progress {
  margin-top: 16px;
  
  .progress-text {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
  }
}

// 上传文件夹样式
.folder-upload-section {
  .upload-step {
    margin-bottom: 20px;

    .step-label {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      font-weight: 500;

      .step-number {
        width: 24px;
        height: 24px;
        background: var(--primary-color);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
      }
    }
  }

  .folder-select-area {
    border: 2px dashed var(--border-color);
    border-radius: 10px;
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s;
    flex-wrap: wrap;

    &:hover {
      border-color: var(--primary-color);
      background: rgba(99, 102, 241, 0.05);
    }

    .folder-icon {
      font-size: 36px;
      color: var(--text-secondary);
    }

    .folder-text {
      color: var(--text-secondary);
    }

    .selected-folder-name {
      font-family: 'Consolas', monospace;
      font-weight: 500;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .folder-preview {
    background: var(--bg-tertiary);
    border-radius: 8px;
    margin-bottom: 20px;

    .preview-header {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      font-size: 13px;

      .file-count {
        color: var(--text-secondary);
      }
    }

    .preview-list {
      padding: 8px 16px;
      max-height: 150px;
      overflow-y: auto;

      .preview-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 0;
        font-size: 12px;

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          color: var(--text-secondary);
        }
      }

      .preview-more {
        padding: 6px 0;
        color: var(--text-secondary);
        font-size: 12px;
      }
    }
  }

  .target-path-section {
    .quick-paths {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;

      .quick-label {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .quick-path-tag {
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          opacity: 0.8;
        }
      }
    }

    .target-input-row {
      display: flex;
      gap: 8px;

      .target-input {
        flex: 1;
      }
    }
  }

  .upload-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 8px;
    font-size: 13px;
    margin-top: 16px;

    code {
      font-family: 'Consolas', monospace;
      color: var(--primary-color);
      font-weight: 500;
    }
  }
}

// 目录浏览器样式
.target-browser {
  .browser-path {
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    margin-bottom: 12px;

    .el-breadcrumb {
      font-size: 13px;
    }

    .clickable {
      cursor: pointer;
      &:hover {
        color: var(--primary-color);
      }
    }
  }

  .browser-list {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    max-height: 300px;
    overflow-y: auto;
    min-height: 200px;

    .browser-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--bg-tertiary);
      }

      &.selected {
        background: rgba(99, 102, 241, 0.1);
      }

      &.parent {
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border-color);
      }
    }

    .browser-empty {
      padding: 40px;
      text-align: center;
      color: var(--text-secondary);
    }
  }

  .browser-selected {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    margin-top: 12px;
    font-size: 13px;

    code {
      font-family: 'Consolas', monospace;
      color: var(--primary-color);
    }
  }
}

.chmod-preview {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;

  .chmod-group {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .chmod-label {
      width: 60px;
      color: var(--text-secondary);
    }
  }
}

.empty-state {
  padding: 60px 0;
}

// 新增样式
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;

  .search-input {
    width: 300px;
  }
}

.bookmarks-popover {
  .bookmarks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 600;
  }

  .bookmarks-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .bookmark-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-tertiary);

      .bookmark-delete {
        opacity: 1;
      }
    }

    .bookmark-path {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bookmark-delete {
      opacity: 0;
      transition: opacity 0.2s;
    }
  }

  .no-bookmarks {
    text-align: center;
    color: var(--text-secondary);
    padding: 20px;
    font-size: 13px;
  }
}

.direct-path-input {
  width: 200px;
}

.clipboard-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.clipboard-tag {
  margin-left: 8px;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;

  &.with-info-panel {
    .file-list-area {
      flex: 1;
      min-width: 0;
    }
  }

  .file-list-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
}

.info-panel {
  width: 280px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;

  .info-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .info-panel-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);

    p {
      margin-top: 12px;
      font-size: 13px;
    }
  }

  .info-panel-content {
    .info-preview {
      display: flex;
      justify-content: center;
      padding: 20px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .info-name {
      font-weight: 600;
      text-align: center;
      margin-bottom: 12px;
      word-break: break-all;
    }

    .info-path {
      font-family: monospace;
      font-size: 11px;
      word-break: break-all;
    }

    .info-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      justify-content: center;
    }
  }

  .info-panel-multi {
    .multi-icon {
      display: flex;
      justify-content: center;
      padding: 20px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .multi-count {
      font-weight: 600;
      text-align: center;
      margin-bottom: 12px;
    }
  }
}

.grid-item.clipboard-item {
  opacity: 0.6;
  border: 1px dashed var(--primary-color);
}

.image-preview-dialog {
  .image-preview-container {
    display: flex;
    justify-content: center;
    align-items: center;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    max-height: 60vh;

    img {
      max-width: 100%;
      max-height: 60vh;
      object-fit: contain;
    }
  }

  .image-preview-info {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    color: var(--text-secondary);
    font-size: 13px;
  }
}

.compress-files-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 8px 0;
  min-width: 160px;
  z-index: 1000;

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-tertiary);
    }

    &.danger {
      color: var(--danger-color);
    }
  }

  .context-menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 4px 0;
  }
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.danger-text {
  color: var(--danger-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

// 历史记录面板样式
.history-badge {
  margin-left: 4px;
}

.history-popover {
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 600;
  }

  .history-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-tertiary);
    }

    .history-info {
      flex: 1;
      min-width: 0;

      .history-name {
        display: block;
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .history-path {
        display: block;
        font-size: 11px;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .history-time {
      font-size: 11px;
      color: var(--text-secondary);
      white-space: nowrap;
    }
  }

  .no-history {
    text-align: center;
    color: var(--text-secondary);
    padding: 30px;
    font-size: 13px;
  }
}

// 代码查看器样式
.file-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-bottom: 12px;

  .file-toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .file-path {
      font-family: monospace;
      font-size: 12px;
      color: var(--text-secondary);
    }
  }

  .file-toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .file-size {
      font-size: 12px;
      color: var(--text-secondary);
    }
  }
}

.file-editor {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;

  &.editing-mode {
    :deep(.el-textarea__inner) {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      background-color: #1e1e1e;
      color: #d4d4d4;
      border: none;
      border-radius: 0;
    }
  }

  .code-viewer {
    display: flex;
    background: #1e1e1e;
    max-height: 500px;
    overflow: auto;

    .line-numbers {
      display: flex;
      flex-direction: column;
      padding: 12px 8px;
      background: #252526;
      color: #858585;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      text-align: right;
      user-select: none;
      border-right: 1px solid #3c3c3c;
      min-width: 50px;

      span {
        padding: 0 8px;
      }
    }

    .code-content {
      flex: 1;
      margin: 0;
      padding: 12px 16px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
      white-space: pre;
      overflow-x: auto;

      code {
        font-family: inherit;
      }

      // 简单的语法高亮
      &.language-javascript,
      &.language-typescript,
      &.language-json {
        .keyword { color: #569cd6; }
        .string { color: #ce9178; }
        .number { color: #b5cea8; }
        .comment { color: #6a9955; }
      }
    }
  }
}

// 文件比较对话框样式
.compare-dialog {
  .compare-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: 8px;

    .compare-files-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .compare-vs {
        font-weight: 600;
        color: var(--text-secondary);
      }
    }
  }

  .compare-content {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .side-by-side-view {
    display: flex;
    height: 60vh;

    .compare-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      &:first-child {
        border-right: 1px solid var(--border-color);
      }

      .compare-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-color);
        font-size: 13px;
        font-weight: 500;

        .file-size {
          font-size: 11px;
          color: var(--text-secondary);
        }
      }

      .compare-panel-content {
        flex: 1;
        display: flex;
        overflow: auto;
        background: #1e1e1e;

        .line-numbers {
          display: flex;
          flex-direction: column;
          padding: 8px 4px;
          background: #252526;
          color: #858585;
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
          line-height: 1.5;
          text-align: right;
          user-select: none;
          border-right: 1px solid #3c3c3c;
          min-width: 40px;

          span {
            padding: 0 6px;
          }
        }

        .code-content {
          flex: 1;
          margin: 0;
          padding: 8px 12px;
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
          line-height: 1.5;
          color: #d4d4d4;
          white-space: pre;
        }
      }
    }
  }

  .unified-view {
    max-height: 60vh;
    overflow: auto;
    background: #1e1e1e;

    .diff-content {
      padding: 8px 0;
    }

    .diff-line {
      display: flex;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.6;

      &.added {
        background: rgba(46, 160, 67, 0.2);

        .diff-indicator {
          color: #3fb950;
        }
      }

      &.removed {
        background: rgba(248, 81, 73, 0.2);

        .diff-indicator {
          color: #f85149;
        }
      }

      &.unchanged {
        .diff-indicator {
          color: #858585;
        }
      }

      .diff-indicator {
        width: 30px;
        text-align: center;
        user-select: none;
        flex-shrink: 0;
      }

      .diff-text {
        flex: 1;
        padding: 0 12px;
        color: #d4d4d4;
        white-space: pre;
      }
    }
  }
}

// 内容搜索结果样式
.content-search-results {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;

  .search-result-item {
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 8px;
    background: var(--bg-tertiary);

    &:last-child {
      margin-bottom: 0;
    }

    .result-file-name {
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .result-matches {
      font-family: monospace;
      font-size: 12px;
      color: var(--text-secondary);

      .match-line {
        padding: 4px 8px;
        border-radius: 4px;
        margin-bottom: 4px;
        background: var(--bg-color);

        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }
}
</style>
