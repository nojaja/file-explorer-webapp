// ヘルパーとしてデータ配置フォルダ(ROOT_PATH)にテストデータの配置、削除を行うメソッドを提供する。
// dotenvにて.envを読み込んだのちにprocess.env.ROOT_PATHからデータフォルダのpathを取得する
// 

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// .env をロードして process.env を設定
dotenv.config();

// ROOT_PATH を取得。指定がなければプロジェクトルートの data ディレクトリを既定とする
const ROOT_PATH = process.env.ROOT_PATH
	? path.join(process.cwd(),process.env.ROOT_PATH)
	: path.join(process.cwd(),'data');

export { ROOT_PATH };

function safeJoin(base, target) {
	// 正規化と先頭スラッシュ除去
	const targetPath = path.normalize(String(target)).replace(/^([/\\])+/, '');
	const resolvedBase = path.resolve(base);
	const resolvedPath = path.resolve(resolvedBase, targetPath);

	// Windows のパス区切りにも対応して厳密なプレフィックスチェックを行う
	const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
	if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(baseWithSep)) {
		throw new Error('パストラバーサル検出: 不正なパスです');
	}
	return resolvedPath;
}

/**
 * テスト用データを配置する
 * @param {string} relativePath ROOT_PATH からの相対パス（先頭に / を付けても可）
 * @param {string|Buffer} content ファイル内容
 * @returns {Promise<string>} 書き込まれた絶対パス
 */
export async function putTestData(relativePath, content) {
	const dest = safeJoin(ROOT_PATH, relativePath);
	const dir = path.dirname(dest);
	try {
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(dest, content);
		//console.log('✅ テストデータ配置完了:', dest);
		return dest;
	} catch (err) {
		console.error('❌ テストデータ配置失敗:', err.message);
		throw err;
	}
}

/**
 * テスト用データを削除する
 * @param {string} relativePath ROOT_PATH からの相対パス
 * @returns {Promise<boolean>} 削除した場合 true、存在しなかった場合 false
 */
export async function removeTestData(relativePath) {
	const target = safeJoin(ROOT_PATH, relativePath);
	try {
		await fs.unlink(target);
		//console.log('✅ テストデータ削除完了:', target);
		return true;
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log('ℹ️ 削除対象が存在しませんでした:', target);
			return false;
		}
		console.error('❌ テストデータ削除失敗:', err.message);
		throw err;
	}
}

/**
 * 配置されているファイルの中身を文字列で取得する
 * @param {string} relativePath ROOT_PATH からの相対パス
 * @returns {Promise<string|null>} ファイルが存在すれば文字列、存在しなければ null
 */
export async function readTestData(relativePath) {
	const target = safeJoin(ROOT_PATH, relativePath);
	try {
		const buf = await fs.readFile(target);
		return buf.toString('utf8');
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log('ℹ️ 読み取り対象が存在しませんでした:', target);
			return null;
		}
		console.error('❌ テストデータ読取失敗:', err.message);
		throw err;
	}
}
