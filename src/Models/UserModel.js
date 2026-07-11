class UserModel {
  constructor(
    id_players,
    name,
    email,
    password,
    lsg_access_token = null,
    lsg_token_expires_at = null,
    lichess_username = null,
    lichess_access_token = null,
    lichess_last_sync_at = null,
    lsg_sensor_endpoint_id = null,
    lsg_players_sensor_endpoint_id = null,
    lichess_activity_snapshot = null,
    lichess_last_status = null,
    htb_academy_session = null,
    htb_last_sync_at = null,
    htb_progress_snapshot = null,
    htb_last_status = null,
    htb_lsg_sensor_endpoint_id = null,
    htb_lsg_players_sensor_endpoint_id = null
  ) {
    this.id_players = id_players;
    this.name = name;
    this.email = email;
    this.password = password;
    this.lsg_access_token = lsg_access_token;
    this.lsg_token_expires_at = lsg_token_expires_at;
    this.lichess_username = lichess_username;
    this.lichess_access_token = lichess_access_token;
    this.lichess_last_sync_at = lichess_last_sync_at;
    this.lsg_sensor_endpoint_id = lsg_sensor_endpoint_id;
    this.lsg_players_sensor_endpoint_id = lsg_players_sensor_endpoint_id;
    this.lichess_activity_snapshot = lichess_activity_snapshot;
    this.lichess_last_status = lichess_last_status;
    this.htb_academy_session = htb_academy_session;
    this.htb_last_sync_at = htb_last_sync_at;
    this.htb_progress_snapshot = htb_progress_snapshot;
    this.htb_last_status = htb_last_status;
    this.htb_lsg_sensor_endpoint_id = htb_lsg_sensor_endpoint_id;
    this.htb_lsg_players_sensor_endpoint_id = htb_lsg_players_sensor_endpoint_id;
  }
}

export default UserModel;
