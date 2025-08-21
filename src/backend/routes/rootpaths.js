import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { 
    getDefaultRootPath, 
    getUserAccessibleRootPaths
} from "../services/authorizationService.js";

const router = express.Router();

/**
 * GET /api/rootpaths - ユーザーがアクセス可能なROOT_PATH一覧を取得
 */
router.get("/", authMiddleware, async (req, res) => {
    console.log('[rootpaths] req.headers.cookie:', req.headers.cookie);
    try {
        const userEmail = req.user?.email || req.session?.user?.email;
        
        if (!userEmail) {
            return res.status(401).json({ 
                error: 'ユーザー情報が取得できません',
                code: 'USER_NOT_FOUND'
            });
        }
        
        const accessibleRootPaths = await getUserAccessibleRootPaths(userEmail);
        // diskSpaceにerrorが含まれている場合は警告ログ
        accessibleRootPaths.forEach(rp => {
            if (rp.diskSpace && rp.diskSpace.error) {
                console.warn(`[rootpaths] ディスク容量取得エラー: id=${rp.id}, path=${rp.path}, error=${rp.diskSpace.error}`);
            }
        });
        const defaultRootPath = getDefaultRootPath();
        
        res.json({
            rootPaths: accessibleRootPaths,
            defaultRootPath: defaultRootPath,
            userEmail: userEmail
        });
    } catch (error) {
        console.error('[RootPath API] ROOT_PATH一覧取得エラー:', error);
        // 既にレスポンスが送信されていないか確認
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'ROOT_PATH一覧の取得に失敗しました',
                code: 'ROOTPATH_LIST_ERROR',
                details: error?.message || error
            });
        } else {
            console.error('[RootPath API] レスポンス送信済みのためエラー応答不可');
        }
    }
});

/**
 * GET /api/rootpaths/:id - 特定ROOT_PATHの詳細情報を取得
 */
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || req.session?.user?.email;
        const rootPathId = req.params.id;
        
        if (!userEmail) {
            return res.status(401).json({ 
                error: 'ユーザー情報が取得できません',
                code: 'USER_NOT_FOUND'
            });
        }
        
        const accessibleRootPaths = await getUserAccessibleRootPaths(userEmail);
        const targetRootPath = accessibleRootPaths.find(rp => rp.id === rootPathId);
        
        if (!targetRootPath) {
            return res.status(403).json({ 
                error: '指定されたROOT_PATHへのアクセス権限がありません',
                code: 'ROOTPATH_ACCESS_DENIED'
            });
        }
        
        res.json({
            rootPath: targetRootPath,
            userEmail: userEmail
        });
    } catch (error) {
        console.error('[RootPath API] ROOT_PATH詳細取得エラー:', error);
        res.status(500).json({ 
            error: 'ROOT_PATH詳細の取得に失敗しました',
            code: 'ROOTPATH_DETAIL_ERROR'
        });
    }
});

/**
 * POST /api/rootpaths/select - ROOT_PATHを選択（セッションに保存）
 */
router.post("/select", authMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || req.session?.user?.email;
        const { rootPathId } = req.body;
        
        if (!userEmail) {
            return res.status(401).json({ 
                error: 'ユーザー情報が取得できません',
                code: 'USER_NOT_FOUND'
            });
        }
        
        if (!rootPathId) {
            return res.status(400).json({ 
                error: 'ROOT_PATH IDが指定されていません',
                code: 'ROOTPATH_ID_REQUIRED'
            });
        }
        
        const accessibleRootPaths = await getUserAccessibleRootPaths(userEmail);
        const targetRootPath = accessibleRootPaths.find(rp => rp.id === rootPathId);
        
        if (!targetRootPath) {
            return res.status(403).json({ 
                error: '指定されたROOT_PATHへのアクセス権限がありません',
                code: 'ROOTPATH_ACCESS_DENIED'
            });
        }
        
        // セッションにROOT_PATH IDを保存
        req.session.selectedRootPathId = rootPathId;
        
        console.log(`[RootPath API] ${userEmail} が ROOT_PATH ${rootPathId} を選択`);
        
        res.json({
            success: true,
            selectedRootPath: targetRootPath,
            userEmail: userEmail
        });
    } catch (error) {
        console.error('[RootPath API] ROOT_PATH選択エラー:', error);
        res.status(500).json({ 
            error: 'ROOT_PATH選択に失敗しました',
            code: 'ROOTPATH_SELECT_ERROR'
        });
    }
});

export default router;
